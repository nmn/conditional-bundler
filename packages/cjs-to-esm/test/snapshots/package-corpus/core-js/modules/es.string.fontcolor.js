import $ from "../internals/export";
import createHTML from "../internals/create-html";
import forcedStringHTMLMethod from "../internals/string-html-forced";
// `String.prototype.fontcolor` method
// https://tc39.es/ecma262/#sec-string.prototype.fontcolor
$({
  target: 'String',
  proto: true,
  forced: forcedStringHTMLMethod('fontcolor')
}, {
  fontcolor: function fontcolor(color) {
    return createHTML(this, 'font', 'color', color);
  }
});
const _cjs_default = {};
export default _cjs_default;
