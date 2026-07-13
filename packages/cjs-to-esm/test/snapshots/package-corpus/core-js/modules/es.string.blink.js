import $ from "../internals/export";
import createHTML from "../internals/create-html";
import forcedStringHTMLMethod from "../internals/string-html-forced";
// `String.prototype.blink` method
// https://tc39.es/ecma262/#sec-string.prototype.blink
$({
  target: 'String',
  proto: true,
  forced: forcedStringHTMLMethod('blink')
}, {
  blink: function blink() {
    return createHTML(this, 'blink', '', '');
  }
});
const _cjs_default = {};
export default _cjs_default;
