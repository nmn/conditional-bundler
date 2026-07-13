import $ from "../internals/export";
import globalThis from "../internals/global-this";
import { set as _set } from "../internals/task";
import schedulersFix from "../internals/schedulers-fix";
var setTask = _set;
// https://github.com/oven-sh/bun/issues/1633
var setImmediate = globalThis.setImmediate ? schedulersFix(setTask, false) : setTask;

// `setImmediate` method
// http://w3c.github.io/setImmediate/#si-setImmediate
$({
  global: true,
  bind: true,
  enumerable: true,
  forced: globalThis.setImmediate !== setImmediate
}, {
  setImmediate: setImmediate
});
const _cjs_default = {};
export default _cjs_default;
