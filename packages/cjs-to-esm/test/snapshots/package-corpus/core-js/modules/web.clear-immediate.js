import $ from "../internals/export";
import globalThis from "../internals/global-this";
import { clear as _clear } from "../internals/task";
var clearImmediate = _clear;

// `clearImmediate` method
// http://w3c.github.io/setImmediate/#si-clearImmediate
$({
  global: true,
  bind: true,
  enumerable: true,
  forced: globalThis.clearImmediate !== clearImmediate
}, {
  clearImmediate: clearImmediate
});
const _cjs_default = {};
export default _cjs_default;
