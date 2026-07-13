import $ from "../internals/export";
import createHTML from "../internals/create-html";
import forcedStringHTMLMethod from "../internals/string-html-forced";
// `String.prototype.link` method
// https://tc39.es/ecma262/#sec-string.prototype.link
$({
  target: 'String',
  proto: true,
  forced: forcedStringHTMLMethod('link')
}, {
  link: function link(url) {
    return createHTML(this, 'a', 'href', url);
  }
});
const _cjs_default = {};
export default _cjs_default;
