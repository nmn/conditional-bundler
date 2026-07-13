import fs from "node:fs/promises";
import path from "node:path";
import {
  getPackageSnapshotDirectory,
  packageCorpus,
  transformCorpusPackage,
} from "../test/helpers/package-corpus.mjs";

for (const corpus of packageCorpus) {
  const result = await transformCorpusPackage(corpus);
  const snapshotDirectory = getPackageSnapshotDirectory(corpus);
  await fs.rm(snapshotDirectory, { recursive: true, force: true });

  for (const [relativeFile, code] of result.outputs) {
    const outputPath = path.join(snapshotDirectory, relativeFile);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, code);
  }
  await fs.writeFile(
    path.join(snapshotDirectory, "manifest.json"),
    `${JSON.stringify(result.manifest, null, 2)}\n`,
  );
  process.stdout.write(
    `${corpus.name}: wrote ${result.outputs.size} transformed files\n`,
  );
}
