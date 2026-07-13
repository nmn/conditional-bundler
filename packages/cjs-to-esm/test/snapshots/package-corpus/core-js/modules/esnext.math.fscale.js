import $ from "../internals/export";
import scale from "../internals/math-scale";
import fround from "../internals/math-fround";
// `Math.fscale` method
// https://rwaldron.github.io/proposal-math-extensions/
$({
  target: 'Math',
  stat: true,
  forced: true
}, {
  fscale: function fscale(x, inLow, inHigh, outLow, outHigh) {
    return fround(scale(x, inLow, inHigh, outLow, outHigh));
  }
});
const _cjs_default = {};
export default _cjs_default;
