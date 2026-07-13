import $ from "../internals/export";
import createHTML from "../internals/create-html";
import forcedStringHTMLMethod from "../internals/string-html-forced";
// `String.prototype.fixed` method
// https://tc39.es/ecma262/#sec-string.prototype.fixed
$({
  target: 'String',
  proto: true,
  forced: forcedStringHTMLMethod('fixed')
}, {
  fixed: function fixed() {
    return createHTML(this, 'tt', '', '');
  }
});
const _cjs_default = {};
export default _cjs_default;
