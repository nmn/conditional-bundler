import $ from "../internals/export";
import fround from "../internals/math-fround";
// `Math.fround` method
// https://tc39.es/ecma262/#sec-math.fround
$({
  target: 'Math',
  stat: true
}, {
  fround: fround
});
const _cjs_default = {};
export default _cjs_default;
