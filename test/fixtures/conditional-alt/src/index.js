import { feature } from "./feature-a.js" with { condition: "EXPERIMENT_B", else: "./feature-b.js" };

export const value = feature;
