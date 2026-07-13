import $ from "../internals/export";
import { charAt as _charAt } from "../internals/string-multibyte";
import requireObjectCoercible from "../internals/require-object-coercible";
import toIntegerOrInfinity from "../internals/to-integer-or-infinity";
import toString from "../internals/to-string";
// TODO: Remove from `core-js@4`

var charAt = _charAt;
// `String.prototype.at` method
// https://github.com/mathiasbynens/String.prototype.at
$({
  target: 'String',
  proto: true,
  forced: true
}, {
  at: function at(index) {
    var S = toString(requireObjectCoercible(this));
    var len = S.length;
    var relativeIndex = toIntegerOrInfinity(index);
    var k = relativeIndex >= 0 ? relativeIndex : len + relativeIndex;
    return k < 0 || k >= len ? undefined : charAt(S, k);
  }
});
const _cjs_default = {};
export default _cjs_default;
