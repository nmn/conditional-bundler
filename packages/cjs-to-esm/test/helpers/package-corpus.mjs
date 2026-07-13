import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformAsync } from "@babel/core";
import cjsToEsmBabelPlugin, { encodeCjsVirtualId } from "../../index.mjs";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export const snapshotRoot = path.join(
  packageRoot,
  "test",
  "snapshots",
  "package-corpus",
);

export const packageCorpus = [
  { name: "@statsig/client-core", snapshotDirectory: "statsig-client-core" },
  { name: "@statsig/js-client", snapshotDirectory: "statsig-js-client" },
  { name: "cookie-parser", snapshotDirectory: "cookie-parser" },
  { name: "core-js", snapshotDirectory: "core-js" },
  { name: "winston", snapshotDirectory: "winston" },
  { name: "undici", snapshotDirectory: "undici" },
];

const packageIdentityByDirectory = new Map();

export async function transformCorpusPackage(corpus) {
  const manifestPath = await fs.realpath(
    path.join(packageRoot, "node_modules", corpus.name, "package.json"),
  );
  const inputRoot = path.dirname(manifestPath);
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  if (manifest.type && manifest.type !== "commonjs") {
    throw new Error(
      `${corpus.name} declares type '${manifest.type}', not CommonJS.`,
    );
  }

  const relativeFiles = await listCodeFiles(inputRoot);
  const outputs = new Map();
  const strategies = { static: 0, conditional: 0, compatibility: 0 };
  const strategiesByFile = new Map();
  for (const relativeFile of relativeFiles) {
    const filePath = path.join(inputRoot, relativeFile);
    const source = await fs.readFile(filePath, "utf8");
    const result = await transformAsync(source, {
      filename: filePath,
      sourceMaps: false,
      plugins: [
        [
          cjsToEsmBabelPlugin,
          {
            id: encodeCjsVirtualId("snapshot", filePath),
            mode: "production",
          },
        ],
      ],
    });
    const code = await normalizeGeneratedCode(result?.code ?? source, filePath);
    outputs.set(relativeFile, `${code}\n`);
    const strategy = result?.metadata?.cjsToEsm?.strategy;
    if (!(strategy in strategies)) {
      throw new Error(
        `${corpus.name}/${relativeFile} did not report a CJS transform strategy.`,
      );
    }
    strategies[strategy] += 1;
    strategiesByFile.set(relativeFile, result.metadata.cjsToEsm);
  }

  return {
    manifest: {
      package: corpus.name,
      version: manifest.version,
      mode: "production",
      files: outputs.size,
      strategies,
    },
    outputs,
    strategiesByFile,
  };
}

export function getPackageSnapshotDirectory(corpus) {
  return path.join(snapshotRoot, corpus.snapshotDirectory);
}

export async function listCodeFiles(root) {
  const files = [];
  await visit(root, "");
  return files.sort();

  async function visit(directory, relativeDirectory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules") {
        continue;
      }
      const relativePath = path.join(relativeDirectory, entry.name);
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath, relativePath);
      } else if (entry.isFile() && /\.(?:js|cjs)$/.test(entry.name)) {
        files.push(toPosixPath(relativePath));
      }
    }
  }
}

async function normalizeGeneratedCode(code, filePath) {
  return code.replaceAll(filePath, await getStablePackagePath(filePath));
}

async function getStablePackagePath(filePath) {
  const identity = await findPackageIdentity(path.dirname(filePath));
  if (!identity) {
    throw new Error(`Could not find package metadata for '${filePath}'.`);
  }
  const relativePath = toPosixPath(path.relative(identity.root, filePath));
  return `${identity.name}@${identity.version}/${relativePath}`;
}

async function findPackageIdentity(directory) {
  const cached = packageIdentityByDirectory.get(directory);
  if (cached) {
    return cached;
  }

  const pending = (async () => {
    try {
      const manifest = JSON.parse(
        await fs.readFile(path.join(directory, "package.json"), "utf8"),
      );
      if (manifest.name && manifest.version) {
        return {
          root: directory,
          name: manifest.name,
          version: manifest.version,
        };
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }

    const parent = path.dirname(directory);
    return parent === directory ? null : findPackageIdentity(parent);
  })();
  packageIdentityByDirectory.set(directory, pending);
  return pending;
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}
