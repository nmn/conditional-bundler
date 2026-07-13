import $ from "../internals/export";
import log1p from "../internals/math-log1p";
// `Math.log1p` method
// https://tc39.es/ecma262/#sec-math.log1p
$({
  target: 'Math',
  stat: true
}, {
  log1p: log1p
});
const _cjs_default = {};
export default _cjs_default;
