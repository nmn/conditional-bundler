import $ from "../internals/export";
import createHTML from "../internals/create-html";
import forcedStringHTMLMethod from "../internals/string-html-forced";
// `String.prototype.small` method
// https://tc39.es/ecma262/#sec-string.prototype.small
$({
  target: 'String',
  proto: true,
  forced: forcedStringHTMLMethod('small')
}, {
  small: function small() {
    return createHTML(this, 'small', '', '');
  }
});
const _cjs_default = {};
export default _cjs_default;
