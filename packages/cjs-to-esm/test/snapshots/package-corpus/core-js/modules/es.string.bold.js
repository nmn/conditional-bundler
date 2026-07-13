import $ from "../internals/export";
import createHTML from "../internals/create-html";
import forcedStringHTMLMethod from "../internals/string-html-forced";
// `String.prototype.bold` method
// https://tc39.es/ecma262/#sec-string.prototype.bold
$({
  target: 'String',
  proto: true,
  forced: forcedStringHTMLMethod('bold')
}, {
  bold: function bold() {
    return createHTML(this, 'b', '', '');
  }
});
const _cjs_default = {};
export default _cjs_default;
