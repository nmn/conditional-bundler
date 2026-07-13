import $ from "../internals/export";
import isIntegralNumber from "../internals/is-integral-number";
// `Number.isInteger` method
// https://tc39.es/ecma262/#sec-number.isinteger
$({
  target: 'Number',
  stat: true
}, {
  isInteger: isIntegralNumber
});
const _cjs_default = {};
export default _cjs_default;
