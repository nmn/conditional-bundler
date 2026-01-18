import { defaultConfig } from "./config.js";

export async function runCli(argv: string[]): Promise<void> {
  const command = argv[2] ?? "build";
  if (command === "build") {
    console.log("Bundler build invoked (stub).", defaultConfig.outputs.outDir);
    return;
  }
  if (command === "clean-cache") {
    console.log("Clean cache (stub).",
      defaultConfig.outputs.outDir
    );
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}
