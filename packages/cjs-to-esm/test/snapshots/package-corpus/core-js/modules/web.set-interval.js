import $ from "../internals/export";
import globalThis from "../internals/global-this";
import schedulersFix from "../internals/schedulers-fix";
var setInterval = schedulersFix(globalThis.setInterval, true);

// Bun / IE9- setInterval additional parameters fix
// https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#dom-setinterval
$({
  global: true,
  bind: true,
  forced: globalThis.setInterval !== setInterval
}, {
  setInterval: setInterval
});
const _cjs_default = {};
export default _cjs_default;
