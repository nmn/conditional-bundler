import $ from "../internals/export";
import createHTML from "../internals/create-html";
import forcedStringHTMLMethod from "../internals/string-html-forced";
// `String.prototype.italics` method
// https://tc39.es/ecma262/#sec-string.prototype.italics
$({
  target: 'String',
  proto: true,
  forced: forcedStringHTMLMethod('italics')
}, {
  italics: function italics() {
    return createHTML(this, 'i', '', '');
  }
});
const _cjs_default = {};
export default _cjs_default;
