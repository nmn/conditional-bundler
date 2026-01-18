import fs from "node:fs/promises";
import path from "node:path";
import { WorkerPool } from "./worker-pool.js";
import { resolveWorkerPath } from "./worker-path.js";
import { createResolver } from "./resolver.js";
import { buildGraph } from "./graph/build.js";
import { resolveExportTables } from "./exports/resolve.js";
import { findCycles } from "./graph/scc.js";
import { normalizeGraphConditions } from "./graph/conditions.js";
import { applyReplacements } from "./linker/rewriter.js";
import { emitConditionalStart, emitConditionalEnd } from "./linker/conditional-markers.js";
import { emitNamespaceObject } from "./linker/namespace.js";
import { emitDynamicImportConstants } from "./linker/dynamic-import-constants.js";
import { stripImportStatements } from "./linker/strip-imports.js";
import { concatParts } from "./concat.js";
import { runTransformModule, runTransformModuleGraph } from "./plugins/run.js";
import type { BundlerConfig, EntrySpec } from "./config.js";
import { readPkgSafe, findPkgRoot, contentHashShort } from "@bundler/shared";
import type { BundlerPlugin } from "./plugins/types.js";
import type { ModuleGraph } from "./graph/build.js";
import type { ModuleNode, Provider, IRHeader, ImportSpecifier } from "@bundler/shared";

export type BuildResult = {
  bundles: Array<{ envId: string; entryId: string; fileName: string }>;
  manifest: Record<string, unknown>;
};

type DynamicImportRef = {
  hashKey: string;
  source: string;
  fromId: string;
};

type BundlePlan = {
  envId: string;
  entryId: string;
  fileName: string;
  parts: string[];
  dynamicImports: DynamicImportRef[];
};

export async function buildProject(config: BundlerConfig, plugins: BundlerPlugin[]): Promise<BuildResult> {
  const cacheDir = path.resolve(config.cacheDir ?? "node_modules/.bundler-cache");
  const pool = new WorkerPool({
    workerPath: resolveWorkerPath(),
    size: config.maxWorkers
  });
  const cleanup = async () => {
    await pool.close();
  };
  const resolver = createResolver();

  const envs = Object.keys(config.envs);
  const headers: IRHeader[] = [];
  const seen = new Set<string>();
  const entryQueue = collectEntries(config.entries);
  const entrySet = new Set(entryQueue.map((entry) => entry.path));
  const dynamicEntries: EntrySpec[] = [];
  const resolvedMap = new Map<string, string>();

  try {
    while (entryQueue.length > 0) {
      const entry = entryQueue.shift();
      if (!entry || seen.has(entry.path)) {
        continue;
      }
      seen.add(entry.path);
      const code = await fs.readFile(entry.path, "utf8");
      const pkgRoot = findPkgRoot(entry.path) ?? path.dirname(entry.path);
      const pkg = readPkgSafe(pkgRoot);
      const pluginResult = await runTransformModule(plugins, {
        code,
        realPath: entry.path,
        pkg,
        syntax: { jsx: entry.path.endsWith(".jsx") || entry.path.endsWith(".tsx"), ts: entry.path.endsWith(".ts") || entry.path.endsWith(".tsx") },
        envs
      });
      if (pluginResult && (pluginResult as { skipCore?: boolean }).skipCore) {
        throw new Error("Custom transform cannot skip core analysis in v1.");
      }
      const multiEnvCode = pluginResult && "codeByEnv" in pluginResult ? pluginResult.codeByEnv : undefined;
      const fallbackCode = pluginResult && "code" in pluginResult ? pluginResult.code : code;
      const response = await pool.run({
        realPath: entry.path,
        code: fallbackCode,
        pkg,
        envs,
        cacheDir,
        syntax: { jsx: entry.path.endsWith(".jsx") || entry.path.endsWith(".tsx"), ts: entry.path.endsWith(".ts") || entry.path.endsWith(".tsx") },
        codeByEnv: multiEnvCode
      });
      const irHeader = (response as { irHeader: IRHeader }).irHeader;
      headers.push(irHeader);

      if (irHeader.flags.hasTopLevelAwait) {
        throw new Error(`E_TLA: Top-level 'await' is not supported (v1). at ${entry.path}`);
      }

      for (const dynamic of irHeader.dynamicImports) {
        const resolved = resolveRelative(entry.path, dynamic.source);
        if (!entrySet.has(resolved)) {
          const dyn = { id: dynamic.hashKey, path: resolved };
          entryQueue.push(dyn);
          dynamicEntries.push(dyn);
          entrySet.add(resolved);
        }
      }

      for (const importEntry of irHeader.imports) {
        if (importEntry.kind === "type") {
          continue;
        }
        for (const envId of envs) {
          const resolved = await resolver(entry.path, importEntry.source, envId);
          resolvedMap.set(resolved.id, resolved.resolvedPath);
          if (!entrySet.has(resolved.resolvedPath)) {
            const next = { id: resolved.id, path: resolved.resolvedPath };
            entryQueue.push(next);
            entrySet.add(resolved.resolvedPath);
          }
        }
      }

      for (const reexport of [...irHeader.exportStars, ...irHeader.reexportsNamed]) {
        for (const envId of envs) {
          const resolved = await resolver(entry.path, reexport.source, envId);
          resolvedMap.set(resolved.id, resolved.resolvedPath);
          if (!entrySet.has(resolved.resolvedPath)) {
            const next = { id: resolved.id, path: resolved.resolvedPath };
            entryQueue.push(next);
            entrySet.add(resolved.resolvedPath);
          }
        }
      }
    }

    const graphs: ModuleGraph[] = [];
    for (const envId of envs) {
      const graph = await buildGraph({ envId, headers, resolver });
      graphs.push(graph);
    }

    const transformedGraphs = await runTransformModuleGraph(plugins, graphs);

    for (const graph of transformedGraphs) {
      const cycles = findCycles(graph.nodes);
      if (cycles.length > 0) {
        throw new Error(`E_CYCLE: Cyclic dependency graph not supported (v1). Cycle: ${cycles[0].join(" -> ")}`);
      }
      normalizeGraphConditions(graph);
      resolveExportTables(Array.from(graph.nodes.values()), graph.nodes);
    }

    const bundlePlans: BundlePlan[] = [];
    for (const graph of transformedGraphs) {
      const entries = pickEntriesForEnv(collectEntries(config.entries), graph.envId);
      for (const entry of entries) {
        bundlePlans.push(await createBundlePlan(graph, entry.path, config));
      }
      const dynamicForEnv = dynamicEntries.filter((entry) => entry.envs?.includes(graph.envId) || !entry.envs);
      for (const entry of dynamicForEnv) {
        if (entries.some((explicit) => explicit.path === entry.path)) {
          continue;
        }
        bundlePlans.push(await createBundlePlan(graph, entry.path, config));
      }
    }

    const bundleMap = new Map<string, string>();
    for (const plan of bundlePlans) {
      const resolved = resolvedMap.get(plan.entryId) ?? plan.entryId;
      bundleMap.set(resolved, plan.fileName);
    }

    const bundles: Array<{ envId: string; entryId: string; fileName: string }> = [];
    for (const plan of bundlePlans) {
      const dynamicMapResolved = resolveDynamicImports(plan.dynamicImports, bundleMap);
      const header = emitDynamicImportConstants(
        plan.dynamicImports.map((entry) => ({ hashKey: entry.hashKey, source: entry.source })),
        dynamicMapResolved
      );
      const patchedBundle = concatParts([header, ...plan.parts]);

      const outputPath = path.join(config.outputs.outDir, plan.fileName);
      await fs.mkdir(config.outputs.outDir, { recursive: true });
      await fs.writeFile(outputPath, patchedBundle, "utf8");
      bundles.push({ envId: plan.envId, entryId: plan.entryId, fileName: plan.fileName });
    }

    return { bundles, manifest: {} };
  } finally {
    await cleanup();
  }
}

function collectEntries(entries: EntrySpec[]): EntrySpec[] {
  return entries.map((entry) => ({ ...entry, id: entry.id || entry.path }));
}

function pickEntriesForEnv(entries: EntrySpec[], envId: string): EntrySpec[] {
  return entries.filter((entry) => !entry.envs || entry.envs.includes(envId));
}

async function createBundlePlan(
  graph: ModuleGraph,
  entryPath: string,
  config: BundlerConfig
): Promise<BundlePlan> {
  const ordered = topoSort(graph, entryPath);
  if (ordered.length === 0) {
    throw new Error(`Entry not found in graph: ${entryPath}`);
  }

  const parts: string[] = [];
  const dynamicImports: DynamicImportRef[] = [];

  for (const node of ordered) {
    const codePath = node.irHeader.codeByEnv[graph.envId] ?? node.irHeader.codeByEnv.default;
    const code = await fs.readFile(codePath, "utf8");

    const replacements: Array<{ start: number; end: number; text: string }> = [];
    for (const importEntry of node.irHeader.imports) {
      for (const spec of importEntry.specifiers) {
        const provider = resolveProvider(graph, node, importEntry, spec);
        if (!provider) {
          continue;
        }
        for (const [start, end] of spec.useRanges) {
          replacements.push({ start, end, text: provider.symbol });
        }
      }
    }

    let processed = code;
    if (replacements.length > 0) {
      processed = applyReplacements(processed, replacements);
    }

    processed = stripImportStatements(processed, node.irHeader.importRanges);
    processed = stripImportStatements(processed, node.irHeader.exportRanges);

    const condition = node.condition;
    if (condition) {
      parts.push(emitConditionalStart(condition));
    }

    parts.push(processed);

    if (node.irHeader.flags.needsNamespaceObject && node.exportTable) {
      parts.push(emitNamespaceObject(node));
    }

    if (condition) {
      parts.push(emitConditionalEnd());
    }

    for (const dyn of node.irHeader.dynamicImports) {
      dynamicImports.push({ hashKey: dyn.hashKey, source: dyn.source, fromId: node.id });
    }
  }

  const dynamicMap: Record<string, string> = {};
  for (const dyn of dynamicImports) {
    dynamicMap[dyn.hashKey] = "";
  }

  const header = emitDynamicImportConstants(
    dynamicImports.map((entry) => ({ hashKey: entry.hashKey, source: entry.source })),
    dynamicMap
  );

  const bundle = concatParts([header, ...parts]);
  const hash = contentHashShort(bundle);
  const fileName = config.outputs.fileName
    ? config.outputs.fileName.replace("[env]", graph.envId).replace("[hash]", hash)
    : `bundle.${graph.envId}.${hash}.js`;

  return { envId: graph.envId, entryId: entryPath, fileName, parts, dynamicImports };
}

function topoSort(graph: ModuleGraph, entryId: string): ModuleNode[] {
  const visited = new Set<string>();
  const stack: ModuleNode[] = [];

  function visit(id: string) {
    if (visited.has(id)) {
      return;
    }
    visited.add(id);
    const node = graph.nodes.get(id);
    if (!node) {
      return;
    }
    for (const dep of node.deps) {
      visit(dep);
    }
    stack.push(node);
  }

  const entryNode = graph.nodes.get(entryId);
  if (entryNode) {
    visit(entryNode.id);
  }
  return stack;
}

function resolveProvider(
  graph: ModuleGraph,
  node: ModuleNode,
  importEntry: IRHeader["imports"][number],
  spec: ImportSpecifier
): Provider | undefined {
  const sourceId = node.resolvedSources.get(importEntry.source);
  if (!sourceId) {
    return undefined;
  }
  const sourceNode = graph.nodes.get(sourceId);
  if (!sourceNode?.exportTable) {
    return undefined;
  }
  if (importEntry.isNamespace && importEntry.namespaceUsage === "dynamic") {
    return {
      moduleId: sourceNode.id,
      symbol: `__NS__${sourceNode.prefix}`
    };
  }
  const provider = sourceNode.exportTable.get(spec.imported);
  if (!provider) {
    return undefined;
  }
  return provider;
}

function resolveRelative(from: string, request: string): string {
  if (!request.startsWith(".")) {
    return request;
  }
  return path.resolve(path.dirname(from), request);
}

function resolveDynamicImports(
  imports: DynamicImportRef[],
  bundleMap: Map<string, string>
): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const dyn of imports) {
    const resolved = resolveRelative(dyn.fromId, dyn.source);
    mapping[dyn.hashKey] = bundleMap.get(resolved) ?? "";
  }
  return mapping;
}

function adjustOffset(
  offset: number,
  drops: Array<[number, number]>,
  current: [number, number],
  replacements: Array<{ start: number; end: number; text: string }>
): number {
  let adjusted = offset;
  for (const [start, end] of drops) {
    if (start === current[0] && end === current[1]) {
      continue;
    }
    if (start >= offset) {
      continue;
    }
    adjusted -= end - start;
  }
  for (const rep of replacements) {
    if (rep.start < offset && rep.end <= offset) {
      adjusted += rep.text.length - (rep.end - rep.start);
    }
  }
  return adjusted;
}
