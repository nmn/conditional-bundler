import { createRequire } from "node:module";

const requireFromBundler = createRequire(import.meta.url);

export function resolveWorkerPath(): string {
  try {
    return requireFromBundler.resolve("@bundler/worker/worker");
  } catch (error) {
    throw new Error(
      "The bundler worker artifact is unavailable. Run the package build before starting the bundler.",
      { cause: error },
    );
  }
}
