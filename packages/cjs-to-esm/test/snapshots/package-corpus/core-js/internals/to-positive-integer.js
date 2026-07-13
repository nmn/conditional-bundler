import toIntegerOrInfinity from "../internals/to-integer-or-infinity";
var $RangeError = RangeError;
const _cjs_default = function (it) {
  var result = toIntegerOrInfinity(it);
  if (result < 0) throw new $RangeError("The argument can't be less than 0");
  return result;
};
export default _cjs_default;
