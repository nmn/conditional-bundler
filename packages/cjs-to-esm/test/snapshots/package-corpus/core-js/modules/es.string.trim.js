import $ from "../internals/export";
import _cjs_import from "../internals/string-trim";
import forcedStringTrimMethod from "../internals/string-trim-forced";
var $trim = _cjs_import.trim;
// `String.prototype.trim` method
// https://tc39.es/ecma262/#sec-string.prototype.trim
$({
  target: 'String',
  proto: true,
  forced: forcedStringTrimMethod('trim')
}, {
  trim: function trim() {
    return $trim(this);
  }
});
const _cjs_default = {};
export default _cjs_default;
