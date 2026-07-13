import $ from "../internals/export";
import getBuiltIn from "../internals/get-built-in";
import validateArgumentsLength from "../internals/validate-arguments-length";
import toString from "../internals/to-string";
import USE_NATIVE_URL from "../internals/url-constructor-detection";
var URL = getBuiltIn('URL');

// `URL.parse` method
// https://url.spec.whatwg.org/#dom-url-parse
$({
  target: 'URL',
  stat: true,
  forced: !USE_NATIVE_URL
}, {
  parse: function parse(url) {
    var length = validateArgumentsLength(arguments.length, 1);
    var urlString = toString(url);
    var base = length < 2 || arguments[1] === undefined ? undefined : toString(arguments[1]);
    try {
      return new URL(urlString, base);
    } catch (error) {
      return null;
    }
  }
});
const _cjs_default = {};
export default _cjs_default;
