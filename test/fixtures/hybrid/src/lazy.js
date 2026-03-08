import * as ns from "./ns.js";

export default function finish(input) {
  return `${input}:${ns.suffix}:${ns["suffix"]}`;
}
