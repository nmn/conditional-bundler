import { feature } from "./feature.js" with { condition: "COND_A" };
import { helper } from "./helper.js";

export const value = `${helper}:${feature}`;
