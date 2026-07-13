import $ from "../internals/export";
import isIntegralNumber from "../internals/is-integral-number";
var abs = Math.abs;

// `Number.isSafeInteger` method
// https://tc39.es/ecma262/#sec-number.issafeinteger
$({
  target: 'Number',
  stat: true
}, {
  isSafeInteger: function isSafeInteger(number) {
    return isIntegralNumber(number) && abs(number) <= 0x1FFFFFFFFFFFFF;
  }
});
const _cjs_default = {};
export default _cjs_default;
