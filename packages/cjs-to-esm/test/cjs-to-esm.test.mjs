import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { transformAsync } from "@babel/core";
import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";
import cjsToEsmBabelPlugin, {
  decodeCjsVirtualId,
  encodeCjsVirtualId,
} from "../index.mjs";

async function transformCjs(source, options = {}) {
  const filePath = options.filePath ?? path.join(os.tmpdir(), "example.cjs");
  const envId = options.envId ?? "client";
  const id = encodeCjsVirtualId(
    envId,
    filePath,
    undefined,
    options.virtualMode,
  );
  return transformAsync(source, {
    filename: filePath,
    sourceMaps: true,
    plugins: [
      [
        cjsToEsmBabelPlugin,
        {
          id,
          filePath,
          envId,
          mode: options.mode ?? "development",
          strategy: options.strategy,
        },
      ],
    ],
  });
}

describe("cjs-to-esm Babel plugin", () => {
  test("converts default and named CommonJS exports", async () => {
    const filePath = path.join(
      os.tmpdir(),
      `cjs-to-esm-${process.pid}-${Date.now()}.cjs`,
    );
    const result = await transformCjs(
      "exports.answer = 42; module.exports.label = 'ready';",
      { filePath },
    );
    const module = await import(
      `data:text/javascript,${encodeURIComponent(result.code)}`
    );

    expect(module.default).toEqual({ answer: 42, label: "ready" });
    expect(module.answer).toBe(42);
    expect(module.label).toBe("ready");
    expect(result.code).not.toContain("__cjs_require__");
    expect(result.metadata.cjsToEsm).toEqual({ strategy: "static" });
  });

  test("turns static requires into ESM imports with original requests", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cjs-to-esm-"));
    const filePath = path.join(directory, "entry.cjs");
    const dependencyPath = path.join(directory, "dependency.cjs");
    await fs.writeFile(dependencyPath, "module.exports = 42;\n");

    const result = await transformCjs(
      "const dependency = require('./dependency.cjs'); module.exports = dependency;",
      { filePath },
    );
    expect(result.code).toContain('import dependency from "./dependency.cjs";');
    expect(result.code).not.toContain("virtual:cjs-to-esm:");
    expect(result.metadata.cjsToEsm).toEqual({ strategy: "static" });
  });

  test("keeps Node built-ins external", async () => {
    const result = await transformCjs(
      "const path = require('path'); exports.separator = path.sep;",
    );

    expect(result.code).toContain('import * as path from "node:path";');
    expect(result.metadata.cjsToEsm).toEqual({ strategy: "static" });
  });

  test("preserves dependency requests for mode-qualified modules", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cjs-to-esm-"));
    const filePath = path.join(directory, "entry.cjs");
    const dependencyPath = path.join(directory, "dependency.cjs");
    await fs.writeFile(dependencyPath, "module.exports = 42;\n");

    const result = await transformCjs(
      "module.exports = require('./dependency.cjs');",
      { filePath, mode: "production", virtualMode: "production" },
    );

    expect(result.code).toContain('from "./dependency.cjs"');
    expect(result.code).not.toContain("virtual:cjs-to-esm:");
    expect(
      decodeCjsVirtualId(
        encodeCjsVirtualId("client", filePath, undefined, "production"),
      ),
    ).toEqual({ envId: "client", mode: "production", filePath });
  });

  test("selects the production NODE_ENV conditional entry", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cjs-to-esm-"));
    const filePath = path.join(directory, "entry.cjs");
    await Promise.all(
      ["production.cjs", "development.cjs"].map((fileName) =>
        fs.writeFile(
          path.join(directory, fileName),
          `module.exports = ${JSON.stringify(fileName)};\n`,
        ),
      ),
    );
    const result = await transformCjs(
      `if (process.env.NODE_ENV === "production") {
  module.exports = require("./production.cjs");
} else {
  module.exports = require("./development.cjs");
}`,
      { filePath, mode: "production" },
    );
    expect(result.code).toContain('from "./production.cjs"');
    expect(result.code).not.toContain("development.cjs");
    expect(result.code).not.toContain("virtual:cjs-to-esm:");
    expect(result.metadata.cjsToEsm).toEqual({ strategy: "conditional" });
  });

  test("ignores nested NODE_ENV checks when selecting an entry branch", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cjs-to-esm-"));
    const filePath = path.join(directory, "entry.cjs");
    await Promise.all(
      ["production.cjs", "development.cjs"].map((fileName) =>
        fs.writeFile(
          path.join(directory, fileName),
          `module.exports = ${JSON.stringify(fileName)};\n`,
        ),
      ),
    );
    const result = await transformCjs(
      `function checkDCE() {
  if (process.env.NODE_ENV !== "production") throw new Error("not removed");
}
if (process.env.NODE_ENV === "production") {
  checkDCE();
  module.exports = require("./production.cjs");
} else {
  module.exports = require("./development.cjs");
}`,
      { filePath, mode: "production" },
    );
    expect(result.code).toContain('from "./production.cjs"');
    expect(result.code).not.toContain("development.cjs");
    expect(result.code).not.toContain("not removed");
    expect(result.metadata.cjsToEsm).toEqual({ strategy: "conditional" });
  });

  test("selects development NODE_ENV conditional dependencies", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "cjs-to-esm-"));
    const filePath = path.join(directory, "entry.cjs");
    await fs.writeFile(
      path.join(directory, "legacy.cjs"),
      "exports.render = () => 'legacy';\n",
    );
    await fs.writeFile(
      path.join(directory, "stream.cjs"),
      "exports.pipe = () => 'stream';\n",
    );
    await fs.writeFile(
      path.join(directory, "unused.cjs"),
      "exports.render = () => 'unused'; exports.pipe = () => 'unused';\n",
    );
    const result = await transformCjs(
      `let legacy, stream;
if (process.env.NODE_ENV === "production") {
  legacy = require("./legacy.cjs");
  stream = require("./stream.cjs");
} else {
  legacy = require("./unused.cjs");
  stream = require("./unused.cjs");
}
exports.render = legacy.render;
exports.pipe = stream.pipe;`,
      { filePath, mode: "development" },
    );
    expect(result.code).toContain('from "./unused.cjs"');
    expect(result.code).not.toContain("legacy.cjs");
    expect(result.code).not.toContain("stream.cjs");
    expect(result.code).not.toContain("virtual:cjs-to-esm:");
    expect(result.code).toContain("export const render");
    expect(result.code).toContain("export const pipe");
    expect(result.metadata.cjsToEsm).toEqual({ strategy: "conditional" });
  });

  test("maps a static export expression to its original location", async () => {
    const filePath = path.join(os.tmpdir(), "mapped-example.cjs");
    const result = await transformCjs(
      "const value = 40;\nexports.answer = value + 2;\n",
      { filePath },
    );
    const generatedLines = result.code.split("\n");
    const line = generatedLines.findIndex((text) => text.includes("value + 2"));
    const column = generatedLines[line].indexOf("value + 2");
    const original = originalPositionFor(new TraceMap(result.map), {
      line: line + 1,
      column,
    });

    expect(original).toMatchObject({
      source: "mapped-example.cjs",
      line: 2,
      column: 17,
    });
  });

  test("recovers TypeScript export boilerplate", async () => {
    const result = await transformCjs(`
Object.defineProperty(exports, "__esModule", { value: true });
exports.Widget = void 0;
class Widget {}
exports.Widget = Widget;
`);

    expect(result.code).toContain("export class Widget {}");
    expect(result.code).not.toContain("__esModule");
    expect(result.code).not.toContain("__cjs_require__");
    expect(result.metadata.cjsToEsm).toEqual({ strategy: "static" });
  });

  test("preserves a statically augmented default export", async () => {
    const result = await transformCjs(`
function parser() {}
function JSONCookie() {}
function JSONCookies() {}
module.exports = parser;
module.exports.JSONCookie = JSONCookie;
module.exports.JSONCookies = JSONCookies;
`);
    const module = await import(
      `data:text/javascript,${encodeURIComponent(result.code)}`
    );

    expect(typeof module.default).toBe("function");
    expect(module.default.JSONCookie).toBe(module.JSONCookie);
    expect(module.default.JSONCookies).toBe(module.JSONCookies);
    expect(result.code).toContain("Object.assign(parser, {");
    expect(result.code).toContain("export function JSONCookie() {}");
    expect(result.code).toContain("export function JSONCookies() {}");
    expect(result.code).not.toContain('_cjs_default["JSONCookie"]');
    expect(result.metadata.cjsToEsm).toEqual({ strategy: "static" });
  });

  test("falls back for nested dynamic requires", async () => {
    const result = await transformCjs(`
function load(name) {
  return require(name);
}
module.exports = load;
`);

    expect(result.code).toContain("function __cjs_require__");
    expect(result.metadata.cjsToEsm).toEqual({
      strategy: "compatibility",
      fallbackReason: "dynamic-require",
    });
  });

  test("can force the compatibility strategy", async () => {
    const result = await transformCjs("exports.answer = 42;", {
      strategy: "compatibility",
    });

    expect(result.code).toContain("function __cjs_require__");
    expect(result.metadata.cjsToEsm).toEqual({ strategy: "compatibility" });
  });
});
