import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { defaultConfig } from "./config.js";
import { buildProject } from "./builder.js";
import { startDevServer } from "./dev/server.js";
import type { BundlerConfig } from "./config.js";

export async function runCli(argv: string[]): Promise<void> {
  const command = argv[2] ?? "build";
  if (command === "build") {
    const config = await loadConfig(argv);
    await buildProject(config, []);
    return;
  }
  if (command === "dev") {
    const config = await loadConfig(argv);
    const port = readFlag(argv, "--port");
    const host = readFlag(argv, "--host");
    const server = await startDevServer({
      ...config,
      dev: {
        ...(config.dev ?? {}),
        hmr: true,
        reactRefresh: config.dev?.reactRefresh ?? true,
        fullReloadOnFailure: config.dev?.fullReloadOnFailure ?? true,
        port: port ? Number(port) : config.dev?.port,
        host: host ?? config.dev?.host,
      },
    });
    console.log(`conditional-bundler dev server running at ${server.url}`);
    await new Promise(() => {});
    return;
  }
  if (command === "clean-cache") {
    console.log("Clean cache (stub).");
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

export async function loadConfig(argv: string[]): Promise<BundlerConfig> {
  const explicitConfig = readFlag(argv, "--config");
  const configPath = explicitConfig
    ? path.resolve(explicitConfig)
    : await findDefaultConfig();
  if (!configPath) {
    return defaultConfig;
  }

  const imported = await import(pathToFileURL(configPath).href);
  const exported = imported.default ?? imported.config ?? imported;
  const loaded =
    typeof exported === "function" ? await exported() : await exported;
  return {
    ...defaultConfig,
    ...loaded,
    configFile: configPath,
    configIdentity: await fs.readFile(configPath, "utf8"),
    targets: loaded.targets ?? defaultConfig.targets,
    environments: loaded.environments ?? defaultConfig.environments,
    entries: loaded.entries ?? defaultConfig.entries,
    outputs: {
      ...defaultConfig.outputs,
      ...(loaded.outputs ?? {}),
    },
    plugins: loaded.plugins ?? defaultConfig.plugins,
    dev: loaded.dev ?? defaultConfig.dev,
  };
}

function readFlag(argv: string[], name: string): string | null {
  const index = argv.indexOf(name);
  if (index < 0) {
    return null;
  }
  return argv[index + 1] ?? null;
}

async function findDefaultConfig(): Promise<string | null> {
  for (const fileName of ["bundler.config.mjs", "bundler.config.js"]) {
    const candidate = path.resolve(fileName);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next default config name.
    }
  }
  return null;
}
