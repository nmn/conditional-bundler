#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(scriptPath), "..");
const examplesDir = path.join(rootDir, "examples");

export async function cleanExampleCaches(exampleNames) {
  const available = await findExamples();
  const selected = exampleNames ?? available;
  const unknown = selected.filter((name) => !available.includes(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown examples: ${unknown.join(", ")}`);
  }

  await Promise.all(
    selected.map((name) =>
      fs.rm(path.join(examplesDir, name, ".cache"), {
        recursive: true,
        force: true,
      }),
    ),
  );
  return selected;
}

async function findExamples() {
  const entries = await fs.readdir(examplesDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const cleaned = await cleanExampleCaches();
  console.log(
    `Deleted example caches for ${cleaned.length} examples:\n${cleaned
      .map((name) => `- ${name}`)
      .join("\n")}`,
  );
}
