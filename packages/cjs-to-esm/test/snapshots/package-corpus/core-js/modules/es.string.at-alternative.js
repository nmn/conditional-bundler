import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this";
import requireObjectCoercible from "../internals/require-object-coercible";
import toIntegerOrInfinity from "../internals/to-integer-or-infinity";
import toString from "../internals/to-string";
import fails from "../internals/fails";
var charAt = uncurryThis(''.charAt);
var FORCED = fails(function () {
  // eslint-disable-next-line es/no-string-prototype-at -- safe
  return '𠮷'.at(-2) !== '\uD842';
});

// `String.prototype.at` method
// https://tc39.es/ecma262/#sec-string.prototype.at
$({
  target: 'String',
  proto: true,
  forced: FORCED
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
