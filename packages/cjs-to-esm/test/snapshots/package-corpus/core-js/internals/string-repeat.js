import toIntegerOrInfinity from "../internals/to-integer-or-infinity";
import toString from "../internals/to-string";
import requireObjectCoercible from "../internals/require-object-coercible";
var $RangeError = RangeError;
var floor = Math.floor;

// `String.prototype.repeat` method implementation
// https://tc39.es/ecma262/#sec-string.prototype.repeat
const _cjs_default = function repeat(count) {
  var str = toString(requireObjectCoercible(this));
  var result = '';
  var n = toIntegerOrInfinity(count);
  if (n < 0 || n === Infinity) throw new $RangeError('Wrong number of repetitions');
  for (; n > 0; (n = floor(n / 2)) && (str += str)) if (n % 2) result += str;
  return result;
};
export default _cjs_default;
