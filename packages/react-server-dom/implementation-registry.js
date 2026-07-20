const implementations = (globalThis.__BUNDLER_RSC_IMPLEMENTATIONS__ ??=
  new Map());

function implementationKey(id, exportName) {
  return `${id}#${exportName}`;
}

export function resolveModuleExportName(chunks, exportName) {
  if (exportName === "*") return exportName;
  if (chunks?.__bundlerEntryExports) return exportName;
  const sourceExportName = exportName === "" ? "default" : exportName;
  const prefix = chunks?.__bundlerModulePrefix;
  if (typeof prefix !== "string") return exportName;
  return `${prefix}_${sourceExportName}`;
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
    moduleExportName: resolveModuleExportName(chunks, exportName),
  };
}

export function registerClientImplementation(id, exportName, implementation) {
  const moduleExportName =
    implementation?.moduleExportName ??
    resolveModuleExportName(implementation?.chunks, exportName);
  const entry = {
    implementation,
    moduleExportName,
    status: "pending",
    value: undefined,
    promise: undefined,
  };
  implementations.set(implementationKey(id, exportName), entry);
  if (moduleExportName !== exportName) {
    implementations.set(implementationKey(id, moduleExportName), entry);
  }
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
        const moduleExportName =
          descriptor.moduleExportName ?? descriptor.exportName ?? exportName;
        entry.value =
          moduleExportName === "*"
            ? namespace
            : moduleExportName === ""
              ? namespace.default
              : namespace[moduleExportName];
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
    const moduleExportName = entry.moduleExportName ?? exportName;
    entry.status = "fulfilled";
    entry.promise = undefined;
    entry.value =
      moduleExportName === "*"
        ? namespace
        : moduleExportName === ""
          ? namespace.default
          : namespace[moduleExportName];
  }
}
