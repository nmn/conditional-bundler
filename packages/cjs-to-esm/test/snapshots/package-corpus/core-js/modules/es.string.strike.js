import $ from "../internals/export";
import createHTML from "../internals/create-html";
import forcedStringHTMLMethod from "../internals/string-html-forced";
// `String.prototype.strike` method
// https://tc39.es/ecma262/#sec-string.prototype.strike
$({
  target: 'String',
  proto: true,
  forced: forcedStringHTMLMethod('strike')
}, {
  strike: function strike() {
    return createHTML(this, 'strike', '', '');
  }
});
const _cjs_default = {};
export default _cjs_default;
