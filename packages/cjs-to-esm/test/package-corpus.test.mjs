import fs from "node:fs/promises";
import path from "node:path";
import { jest } from "@jest/globals";
import {
  getPackageSnapshotDirectory,
  listCodeFiles,
  packageCorpus,
  transformCorpusPackage,
} from "./helpers/package-corpus.mjs";

jest.setTimeout(120_000);

const corpusResults = new Map();
const getCorpusResult = (corpus) => {
  let result = corpusResults.get(corpus.name);
  if (!result) {
    result = transformCorpusPackage(corpus);
    corpusResults.set(corpus.name, result);
  }
  return result;
};

describe.each(packageCorpus)("$name CJS corpus", (corpus) => {
  test("matches every committed transformed file", async () => {
    const actual = await getCorpusResult(corpus);
    const snapshotDirectory = getPackageSnapshotDirectory(corpus);
    const expectedManifest = JSON.parse(
      await fs.readFile(path.join(snapshotDirectory, "manifest.json"), "utf8"),
    );
    const expectedFiles = await listCodeFiles(snapshotDirectory);
    const actualFiles = Array.from(actual.outputs.keys()).sort();
    const actualSet = new Set(actualFiles);
    const expectedSet = new Set(expectedFiles);
    const missing = expectedFiles.filter((file) => !actualSet.has(file));
    const unexpected = actualFiles.filter((file) => !expectedSet.has(file));
    const leakedVirtualSpecifiers = actualFiles.filter((file) =>
      actual.outputs.get(file).includes("virtual:cjs-to-esm:"),
    );
    const changed = [];

    for (const relativeFile of expectedFiles) {
      if (!actualSet.has(relativeFile)) {
        continue;
      }
      const expected = await fs.readFile(
        path.join(snapshotDirectory, relativeFile),
        "utf8",
      );
      if (actual.outputs.get(relativeFile) !== expected) {
        changed.push(relativeFile);
      }
    }

    expect(actual.manifest).toEqual(expectedManifest);
    expect({
      missing: summarize(missing),
      unexpected: summarize(unexpected),
      leakedVirtualSpecifiers: summarize(leakedVirtualSpecifiers),
      changed: summarize(changed),
    }).toEqual({
      missing: [],
      unexpected: [],
      leakedVirtualSpecifiers: [],
      changed: [],
    });
  });
});

test("representative modules use the intended strategy", async () => {
  const byName = new Map(packageCorpus.map((corpus) => [corpus.name, corpus]));
  const statsig = await getCorpusResult(byName.get("@statsig/client-core"));
  const cookieParser = await getCorpusResult(byName.get("cookie-parser"));
  const coreJs = await getCorpusResult(byName.get("core-js"));
  const winston = await getCorpusResult(byName.get("winston"));
  const undici = await getCorpusResult(byName.get("undici"));

  expect(statsig.strategiesByFile.get("src/Diagnostics.js").strategy).toBe(
    "static",
  );
  expect(cookieParser.strategiesByFile.get("index.js").strategy).toBe("static");
  expect(coreJs.strategiesByFile.get("internals/export.js").strategy).toBe(
    "static",
  );
  expect(winston.strategiesByFile.get("lib/winston.js").strategy).toBe(
    "compatibility",
  );
  expect(undici.strategiesByFile.get("index-fetch.js").strategy).toBe(
    "compatibility",
  );
});

function summarize(files) {
  const limit = 20;
  return files.length <= limit
    ? files
    : [...files.slice(0, limit), `... ${files.length - limit} more`];
}
