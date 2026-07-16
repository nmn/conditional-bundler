import $ from "../internals/export";
import _cjs_import from "../internals/string-pad";
import WEBKIT_BUG from "../internals/string-pad-webkit-bug";
var $padStart = _cjs_import.start;
// `String.prototype.padStart` method
// https://tc39.es/ecma262/#sec-string.prototype.padstart
$({
  target: 'String',
  proto: true,
  forced: WEBKIT_BUG
}, {
  padStart: function padStart(maxLength /* , fillString = ' ' */) {
    return $padStart(this, maxLength, arguments.length > 1 ? arguments[1] : undefined);
  }
});
const _cjs_default = {};
export default _cjs_default;
