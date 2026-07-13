import $ from "../internals/export";
import globalThis from "../internals/global-this";
import getBuiltIn from "../internals/get-built-in";
import uncurryThis from "../internals/function-uncurry-this";
import call from "../internals/function-call";
import fails from "../internals/fails";
import toString from "../internals/to-string";
import validateArgumentsLength from "../internals/validate-arguments-length";
import { i2c as _i2c } from "../internals/base64-map";
var i2c = _i2c;
var $btoa = getBuiltIn('btoa');
var $Array = Array;
var join = uncurryThis([].join);
var charAt = uncurryThis(''.charAt);
var charCodeAt = uncurryThis(''.charCodeAt);
var BASIC = !!$btoa && !fails(function () {
  return $btoa('hi') !== 'aGk=';
});
var NO_ARG_RECEIVING_CHECK = BASIC && !fails(function () {
  $btoa();
});
var WRONG_ARG_CONVERSION = BASIC && fails(function () {
  return $btoa(null) !== 'bnVsbA==';
});
var WRONG_ARITY = BASIC && $btoa.length !== 1;

// `btoa` method
// https://html.spec.whatwg.org/multipage/webappapis.html#dom-btoa
$({
  global: true,
  bind: true,
  enumerable: true,
  forced: !BASIC || NO_ARG_RECEIVING_CHECK || WRONG_ARG_CONVERSION || WRONG_ARITY
}, {
  btoa: function btoa(data) {
    validateArgumentsLength(arguments.length, 1);
    // `webpack` dev server bug on IE global methods - use call(fn, global, ...)
    if (BASIC) return call($btoa, globalThis, toString(data));
    var string = toString(data);
    // (string.length + 2) / 3) and then truncating to integer
    // does the ceil automatically.  << 2 will truncate the integer
    // while also doing *4.  ceil(length / 3) quanta, 4 bytes output
    // per quanta for base64.
    var output = new $Array((string.length + 2) / 3 << 2);
    var outputIndex = 0;
    var position = 0;
    var map = i2c;
    var block, charCode;
    while (charAt(string, position) || (map = '=', position % 1)) {
      charCode = charCodeAt(string, position += 3 / 4);
      if (charCode > 0xFF) {
        throw new (getBuiltIn('DOMException'))('The string contains characters outside of the Latin1 range', 'InvalidCharacterError');
      }
      block = block << 8 | charCode;
      output[outputIndex++] = charAt(map, 63 & block >> 8 - position % 1 * 8);
    }
    return join(output, '');
  }
});
const _cjs_default = {};
export default _cjs_default;
