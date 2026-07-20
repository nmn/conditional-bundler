import crypto from "node:crypto";
import path from "node:path";

const wasmHeader = Uint8Array.from([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
]);

export default function transformWasmRepresentation(context) {
  assertWasmInput(context);

  const assetId = context.metadata?.assetId;
  if (typeof assetId !== "string" || !assetId) {
    throw new Error(
      `E_WASM_METADATA: WebAssembly module '${context.canonicalPath}' has no portable asset identity.`,
    );
  }

  const symbolPrefix = `__bundler_${crypto
    .createHash("sha1")
    .update(`${context.moduleIdentity}\0${assetId}\0wasm-url`)
    .digest("hex")
    .slice(0, 12)}_wasm`;
  const publicUrlSymbol = `${symbolPrefix}_public_url`;
  const moduleUrlSymbol = `${symbolPrefix}_module_url`;
  const sourceFileName = canonicalSourceFileName(context.canonicalPath);

  return {
    code: createWasmFacade(publicUrlSymbol, moduleUrlSymbol),
    extraOutputs: {
      "bundler-asset": {
        outputId: assetId,
        contents: context.bytes,
        metadata: {
          assetId,
          canonicalPath: context.canonicalPath,
          sourceFileName,
          extension: ".wasm",
          copy: true,
        },
      },
    },
    linkReferences: [
      {
        id: `${context.moduleIdentity}::wasm-public-output`,
        kind: "output-url",
        outputId: assetId,
        outputType: "asset",
        symbol: publicUrlSymbol,
        ownerId: context.moduleIdentity,
        urlMode: "public",
      },
      {
        id: `${context.moduleIdentity}::wasm-module-output`,
        kind: "output-url",
        outputId: assetId,
        outputType: "asset",
        symbol: moduleUrlSymbol,
        ownerId: context.moduleIdentity,
        urlMode: "module-relative",
      },
    ],
  };
}

function canonicalSourceFileName(canonicalPath) {
  const portablePath = canonicalPath.replaceAll("\\", "/");
  const identitySeparator = portablePath.lastIndexOf("::");
  return path.posix.basename(
    identitySeparator >= 0
      ? portablePath.slice(identitySeparator + 2)
      : portablePath,
  );
}

function assertWasmInput(context) {
  if (!context.canonicalPath.toLowerCase().endsWith(".wasm")) {
    throw new Error(
      `E_REPRESENTATION_TYPE: as: 'wasm' requires a .wasm file, received '${context.canonicalPath}'.`,
    );
  }
  if (
    context.bytes.length < wasmHeader.length ||
    wasmHeader.some((byte, index) => context.bytes[index] !== byte)
  ) {
    throw new Error(
      `E_WASM_INVALID_HEADER: '${context.canonicalPath}' is not a WebAssembly version 1 binary.`,
    );
  }
}

function createWasmFacade(publicUrlSymbol, moduleUrlSymbol) {
  return `let __bundler_wasm_module_promise;

async function __bundler_compile_wasm_module() {
  if (!__bundler_wasm_module_promise) {
    __bundler_wasm_module_promise = __bundler_load_wasm_module().catch((error) => {
      __bundler_wasm_module_promise = undefined;
      throw error;
    });
  }
  return __bundler_wasm_module_promise;
}

async function __bundler_load_wasm_module() {
  const moduleUrl = new URL(${moduleUrlSymbol});
  const url =
    moduleUrl.protocol === "file:"
      ? moduleUrl
      : new URL(${publicUrlSymbol}, moduleUrl);
  if (moduleUrl.protocol === "file:") {
    const { readFile } = await import("node:fs/promises");
    return WebAssembly.compile(await readFile(url));
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      "Failed to load WebAssembly module '" +
        url.href +
        "': HTTP " +
        response.status +
        " " +
        response.statusText,
    );
  }
  const contentType = (response.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (
    contentType === "application/wasm" &&
    typeof WebAssembly.compileStreaming === "function"
  ) {
    return WebAssembly.compileStreaming(response);
  }
  return WebAssembly.compile(await response.arrayBuffer());
}

export default async function init(importObject = {}) {
  return WebAssembly.instantiate(
    await __bundler_compile_wasm_module(),
    importObject,
  );
}`;
}
