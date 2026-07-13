import $ from "../internals/export";
import getBuiltIn from "../internals/get-built-in";
import fails from "../internals/fails";
import validateArgumentsLength from "../internals/validate-arguments-length";
import toString from "../internals/to-string";
import USE_NATIVE_URL from "../internals/url-constructor-detection";
var URL = getBuiltIn('URL');

// https://github.com/nodejs/node/issues/47505
// https://github.com/denoland/deno/issues/18893
var THROWS_WITHOUT_ARGUMENTS = USE_NATIVE_URL && fails(function () {
  URL.canParse();
});

// Bun ~ 1.0.30 bug
// https://github.com/oven-sh/bun/issues/9250
var WRONG_ARITY = fails(function () {
  return URL.canParse.length !== 1;
});

// `URL.canParse` method
// https://url.spec.whatwg.org/#dom-url-canparse
$({
  target: 'URL',
  stat: true,
  forced: !THROWS_WITHOUT_ARGUMENTS || WRONG_ARITY
}, {
  canParse: function canParse(url) {
    var length = validateArgumentsLength(arguments.length, 1);
    var urlString = toString(url);
    var base = length < 2 || arguments[1] === undefined ? undefined : toString(arguments[1]);
    try {
      return !!new URL(urlString, base);
    } catch (error) {
      return false;
    }
  }
});
const _cjs_default = {};
export default _cjs_default;
