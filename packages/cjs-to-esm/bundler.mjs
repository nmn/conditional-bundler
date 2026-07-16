import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCjsModuleIdentity, isNodeBuiltin } from "./index.mjs";

const transformPath = fileURLToPath(new URL("./index.mjs", import.meta.url));
const packageTypeCache = new Map();

export default function cjsToEsmBundlerPlugin(options = {}) {
  const nodeEnv = resolveNodeEnv(options);
  const mode = nodeEnv === "production" ? "production" : "development";

  return {
    name: options.name ?? "cjs-to-esm",
    async resolveImport(context) {
      const { request } = context;
      if (isNodeBuiltin(request)) {
        return { preserve: true };
      }
      const resolved = await context.resolveDefault();
      if ("preserve" in resolved || !isCommonJsFile(resolved.filePath)) {
        return resolved;
      }

      return {
        id: resolved.filePath,
        filePath: resolved.filePath,
        moduleIdentity: createCjsModuleIdentity(resolved.filePath),
        type: "javascript",
        meta: {
          format: "commonjs",
          ...(typeof context.importerMeta?.reactCjsEnv === "string"
            ? { reactCjsEnv: context.importerMeta.reactCjsEnv }
            : {}),
        },
      };
    },
    transform: [
      [
        transformPath,
        {
          strategy: options.strategy ?? "auto",
          mode,
          nodeEnv,
          linkModulePaths: true,
        },
      ],
    ],
  };
}

function resolveNodeEnv(options) {
  const nodeEnv =
    options.nodeEnv ??
    options.mode ??
    process.env.BUNDLER_MODE ??
    process.env.NODE_ENV ??
    "development";
  if (typeof nodeEnv !== "string" || nodeEnv.length === 0) {
    throw new Error("cjs-to-esm requires NODE_ENV to be a non-empty string.");
  }
  return nodeEnv;
}

function isCommonJsFile(filePath) {
  const extension = path.extname(filePath);
  if (extension === ".cjs") return true;
  if (extension !== ".js") return false;

  let directory = path.dirname(filePath);
  while (true) {
    let type = packageTypeCache.get(directory);
    if (type === undefined) {
      try {
        const manifest = JSON.parse(
          fs.readFileSync(path.join(directory, "package.json"), "utf8"),
        );
        type = manifest.type === "module" ? "module" : "commonjs";
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
        type = null;
      }
      packageTypeCache.set(directory, type);
    }
    if (type != null) {
      return type !== "module";
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return true;
    }
    directory = parent;
  }
}
