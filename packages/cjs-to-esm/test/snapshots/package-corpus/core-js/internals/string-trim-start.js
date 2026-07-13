import { start as _start } from "../internals/string-trim";
import forcedStringTrimMethod from "../internals/string-trim-forced";
var $trimStart = _start;
// `String.prototype.{ trimStart, trimLeft }` method
// https://tc39.es/ecma262/#sec-string.prototype.trimstart
// https://tc39.es/ecma262/#String.prototype.trimleft
const _cjs_default = forcedStringTrimMethod('trimStart') ? function trimStart() {
  return $trimStart(this);
  // eslint-disable-next-line es/no-string-prototype-trimstart-trimend -- safe
} : ''.trimStart;
export default _cjs_default;
