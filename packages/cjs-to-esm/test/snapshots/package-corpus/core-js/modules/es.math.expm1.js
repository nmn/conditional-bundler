import $ from "../internals/export";
import expm1 from "../internals/math-expm1";
// `Math.expm1` method
// https://tc39.es/ecma262/#sec-math.expm1
// eslint-disable-next-line es/no-math-expm1 -- required for testing
$({
  target: 'Math',
  stat: true,
  forced: expm1 !== Math.expm1
}, {
  expm1: expm1
});
const _cjs_default = {};
export default _cjs_default;
