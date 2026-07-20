import vm from "node:vm";
import transformWasmRepresentation from "../transform.mjs";

const importedFunctionWasm = Buffer.from(
  "0061736d0100000001060160017f017f020e0103656e76066f6666736574000003020100070d01096164644f666673657400010a08010600200010000b",
  "hex",
);

function transform(
  bytes = importedFunctionWasm,
  canonicalPath = "app@1::math.wasm",
) {
  return transformWasmRepresentation({
    id: `${canonicalPath}::as=wasm::environment=app`,
    moduleIdentity: `${canonicalPath}::as=wasm::environment=app`,
    canonicalPath,
    representation: "url",
    environmentId: "app",
    source: "",
    bytes,
    metadata: {
      assetId: canonicalPath,
    },
    pkg: { name: "app", version: "1.0.0" },
    buildMode: "production",
    dev: { hmr: false },
  });
}

test("emits the original Wasm bytes and a linked initializer facade", () => {
  const result = transform();
  const output = result.extraOutputs["bundler-asset"];
  const publicReference = result.linkReferences.find(
    (reference) => reference.urlMode === "public",
  );
  const moduleReference = result.linkReferences.find(
    (reference) => reference.urlMode === "module-relative",
  );

  expect(output.outputId).toBe("app@1::math.wasm");
  expect(output.contents).toBe(importedFunctionWasm);
  expect(output.metadata).toMatchObject({
    assetId: "app@1::math.wasm",
    sourceFileName: "math.wasm",
    extension: ".wasm",
    copy: true,
  });
  expect(publicReference).toMatchObject({
    kind: "output-url",
    outputId: "app@1::math.wasm",
    outputType: "asset",
    urlMode: "public",
  });
  expect(moduleReference).toMatchObject({
    kind: "output-url",
    outputId: "app@1::math.wasm",
    outputType: "asset",
    urlMode: "module-relative",
  });
  expect(result.code).toContain(
    `new URL(${publicReference.symbol}, moduleUrl)`,
  );
  expect(result.code).toContain(`new URL(${moduleReference.symbol})`);
  expect(result.code).toContain("export default async function init");
});

test.each([
  [
    "a non-Wasm extension",
    importedFunctionWasm,
    "app@1::math.bin",
    "E_REPRESENTATION_TYPE",
  ],
  [
    "an invalid header",
    Buffer.from("not wasm"),
    "app@1::math.wasm",
    "E_WASM_INVALID_HEADER",
  ],
])("rejects %s", (_name, bytes, canonicalPath, expected) => {
  expect(() => transform(bytes, canonicalPath)).toThrow(expected);
});

test.each(["application/wasm", "application/octet-stream"])(
  "loads over HTTP with %s and caches compilation",
  async (contentType) => {
    let requests = 0;
    const fetch = async () => {
      requests += 1;
      return new Response(importedFunctionWasm, {
        headers: { "content-type": contentType },
      });
    };

    const result = transform();
    const code = result.linkReferences.reduce(
      (current, reference) =>
        current.replace(
          reference.symbol,
          JSON.stringify("https://example.test/math.wasm"),
        ),
      result.code,
    );
    const module = new vm.SourceTextModule(code, {
      context: vm.createContext({ fetch, URL, WebAssembly }),
      identifier: `https://example.test/facade-${encodeURIComponent(contentType)}.js`,
    });
    await module.link(() => {
      throw new Error("The HTTP loader should not import Node modules.");
    });
    await module.evaluate();
    const namespace = module.namespace;

    const first = await namespace.default({
      env: { offset: (value) => value + 2 },
    });
    const second = await namespace.default({
      env: { offset: (value) => value + 5 },
    });

    expect(first).toBeInstanceOf(WebAssembly.Instance);
    expect(second).toBeInstanceOf(WebAssembly.Instance);
    expect(first).not.toBe(second);
    expect(first.exports.addOffset(7)).toBe(9);
    expect(second.exports.addOffset(7)).toBe(12);
    expect(requests).toBe(1);
  },
);
