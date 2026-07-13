import $ from "../internals/export";
import createHTML from "../internals/create-html";
import forcedStringHTMLMethod from "../internals/string-html-forced";
// `String.prototype.fontsize` method
// https://tc39.es/ecma262/#sec-string.prototype.fontsize
$({
  target: 'String',
  proto: true,
  forced: forcedStringHTMLMethod('fontsize')
}, {
  fontsize: function fontsize(size) {
    return createHTML(this, 'font', 'size', size);
  }
});
const _cjs_default = {};
export default _cjs_default;
