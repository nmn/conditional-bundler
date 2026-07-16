import $ from "../internals/export";
import _cjs_import from "../internals/string-pad";
import WEBKIT_BUG from "../internals/string-pad-webkit-bug";
var $padEnd = _cjs_import.end;
// `String.prototype.padEnd` method
// https://tc39.es/ecma262/#sec-string.prototype.padend
$({
  target: 'String',
  proto: true,
  forced: WEBKIT_BUG
}, {
  padEnd: function padEnd(maxLength /* , fillString = ' ' */) {
    return $padEnd(this, maxLength, arguments.length > 1 ? arguments[1] : undefined);
  }
});
const _cjs_default = {};
export default _cjs_default;
