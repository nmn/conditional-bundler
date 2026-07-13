import $ from "../internals/export";
import log2 from "../internals/math-log2";
// `Math.log2` method
// https://tc39.es/ecma262/#sec-math.log2
$({
  target: 'Math',
  stat: true
}, {
  log2: log2
});
const _cjs_default = {};
export default _cjs_default;
