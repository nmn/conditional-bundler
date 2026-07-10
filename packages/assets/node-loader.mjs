import {
  createEnvironmentConditionEvaluator,
  transformConditionalBundle,
} from "./dist/index.js";

const conditionMarker = "/////##CONDITION_START##";
const evaluateCondition = createEnvironmentConditionEvaluator(process.env);
const transformedModules = new Map();

export async function load(url, context, nextLoad) {
  const loaded = await nextLoad(url, context);
  if (loaded.format !== "module" || loaded.source == null) {
    return loaded;
  }

  const source =
    typeof loaded.source === "string"
      ? loaded.source
      : Buffer.from(loaded.source).toString("utf8");
  if (!source.includes(conditionMarker)) {
    return loaded;
  }

  const transformed = await transformConditionalBundle(
    source,
    evaluateCondition,
    {
      cache: {
        get(key) {
          return transformedModules.get(`${url}:${key}`);
        },
        set(key, code) {
          transformedModules.set(`${url}:${key}`, code);
        },
      },
    },
  );
  return { ...loaded, source: transformed.code };
}
