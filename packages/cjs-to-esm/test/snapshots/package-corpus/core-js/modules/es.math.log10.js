import $ from "../internals/export";
import log10 from "../internals/math-log10";
// `Math.log10` method
// https://tc39.es/ecma262/#sec-math.log10
$({
  target: 'Math',
  stat: true
}, {
  log10: log10
});
const _cjs_default = {};
export default _cjs_default;
