import { label } from "./barrel.js";
import { feature } from "./feature.js" with {
  condition: "FLAG_A",
  else: "./fallback.js",
};

export async function run(key) {
  const mod = await import("./lazy.js");
  return mod.default(`${label}:${feature}:${key}`);
}
