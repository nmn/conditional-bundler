import $ from "../internals/export";
import $clamp from "../internals/math-clamp";
import thisNumberValue from "../internals/this-number-value";
// `Number.prototype.clamp` method
// https://github.com/tc39/proposal-math-clamp
$({
  target: 'Number',
  proto: true,
  forced: true
}, {
  clamp: function clamp(min, max) {
    return $clamp(thisNumberValue(this), min, max);
  }
});
const _cjs_default = {};
export default _cjs_default;
