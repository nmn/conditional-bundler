import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this";
import requireObjectCoercible from "../internals/require-object-coercible";
import toString from "../internals/to-string";
var charCodeAt = uncurryThis(''.charCodeAt);

// `String.prototype.isWellFormed` method
// https://tc39.es/ecma262/#sec-string.prototype.iswellformed
$({
  target: 'String',
  proto: true
}, {
  isWellFormed: function isWellFormed() {
    var S = toString(requireObjectCoercible(this));
    var length = S.length;
    for (var i = 0; i < length; i++) {
      var charCode = charCodeAt(S, i);
      // single UTF-16 code unit
      if ((charCode & 0xF800) !== 0xD800) continue;
      // unpaired surrogate
      if (charCode >= 0xDC00 || ++i >= length || (charCodeAt(S, i) & 0xFC00) !== 0xDC00) return false;
    }
    return true;
  }
});
const _cjs_default = {};
export default _cjs_default;
