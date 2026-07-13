import $ from "../internals/export";
import createHTML from "../internals/create-html";
import forcedStringHTMLMethod from "../internals/string-html-forced";
// `String.prototype.big` method
// https://tc39.es/ecma262/#sec-string.prototype.big
$({
  target: 'String',
  proto: true,
  forced: forcedStringHTMLMethod('big')
}, {
  big: function big() {
    return createHTML(this, 'big', '', '');
  }
});
const _cjs_default = {};
export default _cjs_default;
