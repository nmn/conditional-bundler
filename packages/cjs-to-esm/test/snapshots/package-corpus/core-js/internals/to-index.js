import toIntegerOrInfinity from "../internals/to-integer-or-infinity";
import toLength from "../internals/to-length";
var $RangeError = RangeError;

// `ToIndex` abstract operation
// https://tc39.es/ecma262/#sec-toindex
const _cjs_default = function (it) {
  if (it === undefined) return 0;
  var number = toIntegerOrInfinity(it);
  var length = toLength(number);
  if (number !== length) throw new $RangeError('Wrong length or index');
  return length;
};
export default _cjs_default;
