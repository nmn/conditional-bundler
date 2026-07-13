import $ from "../internals/export";
import createHTML from "../internals/create-html";
import forcedStringHTMLMethod from "../internals/string-html-forced";
// `String.prototype.sup` method
// https://tc39.es/ecma262/#sec-string.prototype.sup
$({
  target: 'String',
  proto: true,
  forced: forcedStringHTMLMethod('sup')
}, {
  sup: function sup() {
    return createHTML(this, 'sup', '', '');
  }
});
const _cjs_default = {};
export default _cjs_default;
