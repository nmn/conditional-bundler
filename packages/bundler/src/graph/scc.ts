export function findCycles(nodes: Map<string, { deps: string[] }>): string[][] {
  const indexMap = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles: string[][] = [];
  let index = 0;

  function strongConnect(nodeId: string): void {
    indexMap.set(nodeId, index);
    lowlink.set(nodeId, index);
    index += 1;
    stack.push(nodeId);
    onStack.add(nodeId);

    const node = nodes.get(nodeId);
    if (node) {
      for (const dep of node.deps) {
        if (!indexMap.has(dep)) {
          strongConnect(dep);
          lowlink.set(nodeId, Math.min(lowlink.get(nodeId) ?? 0, lowlink.get(dep) ?? 0));
        } else if (onStack.has(dep)) {
          lowlink.set(nodeId, Math.min(lowlink.get(nodeId) ?? 0, indexMap.get(dep) ?? 0));
        }
      }
    }

    if ((lowlink.get(nodeId) ?? 0) === (indexMap.get(nodeId) ?? 0)) {
      const component: string[] = [];
      while (true) {
        const w = stack.pop();
        if (!w) {
          break;
        }
        onStack.delete(w);
        component.push(w);
        if (w === nodeId) {
          break;
        }
      }
      if (component.length > 1) {
        cycles.push(component);
      }
    }
  }

  for (const nodeId of nodes.keys()) {
    if (!indexMap.has(nodeId)) {
      strongConnect(nodeId);
    }
  }

  return cycles;
}
