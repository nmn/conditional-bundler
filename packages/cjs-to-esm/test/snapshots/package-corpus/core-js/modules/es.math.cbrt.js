import $ from "../internals/export";
import sign from "../internals/math-sign";
var abs = Math.abs;
var pow = Math.pow;

// `Math.cbrt` method
// https://tc39.es/ecma262/#sec-math.cbrt
$({
  target: 'Math',
  stat: true
}, {
  cbrt: function cbrt(x) {
    var n = +x;
    return sign(n) * pow(abs(n), 1 / 3);
  }
});
const _cjs_default = {};
export default _cjs_default;
