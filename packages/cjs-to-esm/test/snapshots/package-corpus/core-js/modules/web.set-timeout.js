import $ from "../internals/export";
import globalThis from "../internals/global-this";
import schedulersFix from "../internals/schedulers-fix";
var setTimeout = schedulersFix(globalThis.setTimeout, true);

// Bun / IE9- setTimeout additional parameters fix
// https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#dom-settimeout
$({
  global: true,
  bind: true,
  forced: globalThis.setTimeout !== setTimeout
}, {
  setTimeout: setTimeout
});
const _cjs_default = {};
export default _cjs_default;
