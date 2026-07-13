import aNumber from "../internals/a-number";
var $min = Math.min;
var $max = Math.max;
const _cjs_default = function clamp(value, min, max) {
  return $min($max(aNumber(value), aNumber(min)), aNumber(max));
};
export default _cjs_default;
