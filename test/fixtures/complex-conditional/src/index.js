import { pick } from "./pick.js" with { condition: "COND_A", else: "./alt.js" };
import { shared } from "./shared.js";

export function run() {
  return pick(shared);
}
