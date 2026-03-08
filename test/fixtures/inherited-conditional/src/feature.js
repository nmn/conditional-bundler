import { helper } from "./helper.js" with {
  condition: "COND_B",
  else: "./fallback.js",
};

export const feature = helper;
