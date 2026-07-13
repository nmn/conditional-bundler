import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this";
import requireObjectCoercible from "../internals/require-object-coercible";
import toIntegerOrInfinity from "../internals/to-integer-or-infinity";
import toString from "../internals/to-string";
var stringSlice = uncurryThis(''.slice);
var max = Math.max;
var min = Math.min;

// eslint-disable-next-line unicorn/prefer-string-slice -- required for testing
var FORCED = !''.substr || 'ab'.substr(-1) !== 'b';

// `String.prototype.substr` method
// https://tc39.es/ecma262/#sec-string.prototype.substr
$({
  target: 'String',
  proto: true,
  forced: FORCED
}, {
  substr: function substr(start, length) {
    var that = toString(requireObjectCoercible(this));
    var size = that.length;
    var intStart = toIntegerOrInfinity(start);
    var finalStart = intStart < 0 ? max(size + intStart, 0) : min(intStart, size);
    var intLength = length === undefined ? size : toIntegerOrInfinity(length);
    if (intLength <= 0) return '';
    var intEnd = min(finalStart + intLength, size);
    return finalStart >= intEnd ? '' : stringSlice(that, finalStart, intEnd);
  }
});
const _cjs_default = {};
export default _cjs_default;
