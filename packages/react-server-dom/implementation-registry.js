const implementations = (globalThis.__BUNDLER_RSC_IMPLEMENTATIONS__ ??=
  new Map());

function implementationKey(id, exportName) {
  return `${id}#${exportName}`;
}

export function createClientImplementation(chunks, exportName) {
  if (!Array.isArray(chunks) || chunks.some((url) => typeof url !== "string")) {
    throw new TypeError(
      "Client implementation chunks must be an array of URLs.",
    );
  }
  return {
    chunks: [...chunks],
    exportName,
  };
}

export function registerClientImplementation(id, exportName, implementation) {
  implementations.set(implementationKey(id, exportName), {
    implementation,
    status: "pending",
    value: undefined,
    promise: undefined,
  });
}

export function preloadClientImplementation(id, exportName) {
  const entry = implementations.get(implementationKey(id, exportName));
  if (!entry) {
    throw new Error(
      `Missing SSR Client Component implementation '${id}#${exportName}'.`,
    );
  }
  if (entry.status === "fulfilled") return null;
  if (entry.status === "rejected") throw entry.value;
  if (entry.promise) return entry.promise;

  const descriptor = entry.implementation;
  if (
    descriptor &&
    typeof descriptor === "object" &&
    Array.isArray(descriptor.chunks)
  ) {
    entry.promise = Promise.all(
      descriptor.chunks.map((url) => import(url)),
    ).then(
      (modules) => {
        const namespace = modules[0];
        if (!namespace) {
          throw new Error(`SSR Client Component '${id}' has no entry chunk.`);
        }
        entry.status = "fulfilled";
        entry.value =
          exportName === "*"
            ? namespace
            : exportName === ""
              ? namespace.default
              : namespace[exportName];
        return entry.value;
      },
      (error) => {
        entry.status = "rejected";
        entry.value = error;
        throw error;
      },
    );
    return entry.promise;
  }

  entry.status = "fulfilled";
  entry.value = descriptor;
  return null;
}

export function requireClientImplementation(id, exportName) {
  const entry = implementations.get(implementationKey(id, exportName));
  if (!entry) {
    throw new Error(
      `Missing SSR Client Component implementation '${id}#${exportName}'.`,
    );
  }
  if (entry.status === "rejected") throw entry.value;
  if (entry.status !== "fulfilled") {
    throw (
      entry.promise ??
      new Error(`SSR Client Component '${id}#${exportName}' was not preloaded.`)
    );
  }
  return entry.value;
}

export function updateClientImplementationModule(id, namespace) {
  for (const [key, entry] of implementations) {
    if (!key.startsWith(`${id}#`)) continue;
    const exportName = key.slice(id.length + 1);
    entry.status = "fulfilled";
    entry.promise = undefined;
    entry.value =
      exportName === "*"
        ? namespace
        : exportName === ""
          ? namespace.default
          : namespace[exportName];
  }
}
