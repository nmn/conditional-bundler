export type ResolveResult = {
  id: string;
  resolvedPath: string;
};

export type Resolver = (from: string, source: string, envId: string) => Promise<ResolveResult>;

export function createResolver(): Resolver {
  return async (from: string, source: string) => {
    return {
      id: `${from}::${source}`,
      resolvedPath: source
    };
  };
}
