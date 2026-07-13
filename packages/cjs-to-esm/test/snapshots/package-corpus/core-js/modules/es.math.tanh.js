import $ from "../internals/export";
import expm1 from "../internals/math-expm1";
var exp = Math.exp;

// `Math.tanh` method
// https://tc39.es/ecma262/#sec-math.tanh
$({
  target: 'Math',
  stat: true
}, {
  tanh: function tanh(x) {
    var n = +x;
    var a = expm1(n);
    var b = expm1(-n);
    return a === Infinity ? 1 : b === Infinity ? -1 : (a - b) / (exp(n) + exp(-n));
  }
});
const _cjs_default = {};
export default _cjs_default;
