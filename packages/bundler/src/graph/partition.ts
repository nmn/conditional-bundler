import type { ModuleGraph } from "./build.js";

export type BundlePlan = {
  envId: string;
  entryId: string;
  moduleIds: string[];
};

export function defaultPartition(graphs: ModuleGraph[], entries: string[]): BundlePlan[] {
  const plans: BundlePlan[] = [];
  for (const graph of graphs) {
    for (const entry of entries) {
      plans.push({ envId: graph.envId, entryId: entry, moduleIds: Array.from(graph.nodes.keys()) });
    }
  }
  return plans;
}
