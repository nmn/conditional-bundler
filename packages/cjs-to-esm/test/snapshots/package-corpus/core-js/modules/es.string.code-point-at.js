import $ from "../internals/export";
import _cjs_import from "../internals/string-multibyte";
var codeAt = _cjs_import.codeAt;

// `String.prototype.codePointAt` method
// https://tc39.es/ecma262/#sec-string.prototype.codepointat
$({
  target: 'String',
  proto: true
}, {
  codePointAt: function codePointAt(pos) {
    return codeAt(this, pos);
  }
});
const _cjs_default = {};
export default _cjs_default;
