import { defaultConfig } from "./config.js";
import { buildProject } from "./builder.js";

export async function runCli(argv: string[]): Promise<void> {
  const command = argv[2] ?? "build";
  if (command === "build") {
    await buildProject(defaultConfig, []);
    return;
  }
  if (command === "clean-cache") {
    console.log("Clean cache (stub).");
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}
