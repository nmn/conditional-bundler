/**
 * Mechanical test-suite migration helper. Production configuration has no
 * compatibility path for `envs`; this converts older fixtures before they
 * reach the public build API so legacy feature assertions can remain focused
 * on the behavior they were written to exercise.
 */
export function withTestConfig(buildProject) {
  return async (config, plugins) =>
    adaptLegacyFixtureResult(
      await buildProject(migrateTestConfig(config), plugins),
    );
}

export function migrateTestConfig(config) {
  if (!config.envs) return config;

  const oldEnvironments = config.envs;
  const environmentIds = Object.keys(oldEnvironments);
  const targets = Object.fromEntries(
    Object.entries(oldEnvironments).map(([id, value]) => [
      id,
      {
        platform: value.target === "node" ? "node" : "browser",
        ...(value.defines ? { defines: value.defines } : {}),
      },
    ]),
  );
  const entries = config.entries.flatMap((entry) => {
    const selected = entry.envs ?? environmentIds;
    return selected.map((environment) => {
      const rest = { ...entry };
      delete rest.id;
      delete rest.envs;
      return {
        ...rest,
        environment,
        targets: [environment],
      };
    });
  });

  const rest = { ...config };
  delete rest.envs;
  return {
    ...rest,
    targets,
    environments: Object.fromEntries(environmentIds.map((id) => [id, {}])),
    entries,
    outputs: {
      ...config.outputs,
      fileName: config.outputs.fileName?.replaceAll("[env]", "[environment]"),
      cssFileName: config.outputs.cssFileName?.replaceAll(
        "[env]",
        "[environment]",
      ),
    },
  };
}

function adaptLegacyFixtureResult(result) {
  const entrypointAliases = {};
  const dynamicAliases = {};
  const conditionAliases = {};
  for (const bundle of result.bundles) {
    for (const entrypoint of bundle.entrypoints) {
      const oldKey = `${entrypoint.environmentId}:${entrypoint.entryId}`;
      const concreteKey = `${entrypoint.envId}:${entrypoint.entryId}`;
      if (result.manifest.entrypoints[concreteKey]) {
        entrypointAliases[oldKey] = result.manifest.entrypoints[concreteKey];
      }
      if (result.manifest.dynamicImports[concreteKey]) {
        dynamicAliases[oldKey] = result.manifest.dynamicImports[concreteKey];
      }
      const conditions =
        result.manifest.metadata?.conditions?.byBundle?.[concreteKey];
      if (conditions) {
        conditionAliases[oldKey] = conditions;
      }
    }
  }

  Object.assign(result.manifest.entrypoints, entrypointAliases);
  Object.assign(result.manifest.dynamicImports, dynamicAliases);
  if (result.manifest.metadata?.conditions?.byBundle) {
    Object.assign(
      result.manifest.metadata.conditions.byBundle,
      conditionAliases,
    );
  }
  result.entrypoints = result.manifest.entrypoints;

  if (result.hmr?.bundles) {
    for (const bundle of result.bundles) {
      for (const entrypoint of bundle.entrypoints) {
        const concreteKey = `${entrypoint.envId}:${entrypoint.entryId}`;
        const fixtureKey = `${entrypoint.environmentId}:${entrypoint.entryId}`;
        if (result.hmr.bundles[concreteKey]) {
          result.hmr.bundles[fixtureKey] = result.hmr.bundles[concreteKey];
        }
      }
    }
  }

  const legacyBundleKeys = new Map(
    result.bundles.flatMap((bundle) =>
      bundle.entrypoints.map((entrypoint) => [
        `${entrypoint.envId}:${entrypoint.entryId}`,
        `${entrypoint.environmentId}:${entrypoint.entryId}`,
      ]),
    ),
  );
  const adaptBundle = (bundle) => ({
    ...bundle,
    envId: bundle.environmentId ?? bundle.envId,
    entrypoints: bundle.entrypoints.map((entrypoint) => ({
      ...entrypoint,
      envId: entrypoint.environmentId,
    })),
  });
  result.bundles = result.bundles.map(adaptBundle);
  result.manifest.bundles = result.manifest.bundles.map(adaptBundle);
  result.manifest.assets = result.manifest.assets?.map((asset) => ({
    ...asset,
    envId: asset.environmentId ?? asset.envId,
    bundleKey: legacyBundleKeys.get(asset.bundleKey) ?? asset.bundleKey,
  }));
  return result;
}
