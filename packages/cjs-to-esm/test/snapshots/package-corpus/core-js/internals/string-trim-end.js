import { end as _end } from "../internals/string-trim";
import forcedStringTrimMethod from "../internals/string-trim-forced";
var $trimEnd = _end;
// `String.prototype.{ trimEnd, trimRight }` method
// https://tc39.es/ecma262/#sec-string.prototype.trimend
// https://tc39.es/ecma262/#String.prototype.trimright
const _cjs_default = forcedStringTrimMethod('trimEnd') ? function trimEnd() {
  return $trimEnd(this);
  // eslint-disable-next-line es/no-string-prototype-trimstart-trimend -- safe
} : ''.trimEnd;
export default _cjs_default;
