import $ from "../internals/export";
import trunc from "../internals/math-trunc";
// `Math.trunc` method
// https://tc39.es/ecma262/#sec-math.trunc
$({
  target: 'Math',
  stat: true
}, {
  trunc: trunc
});
const _cjs_default = {};
export default _cjs_default;
