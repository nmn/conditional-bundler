import $ from "../internals/export";
// `Number.MIN_SAFE_INTEGER` constant
// https://tc39.es/ecma262/#sec-number.min_safe_integer
$({
  target: 'Number',
  stat: true,
  nonConfigurable: true,
  nonWritable: true
}, {
  MIN_SAFE_INTEGER: -0x1FFFFFFFFFFFFF
});
const _cjs_default = {};
export default _cjs_default;
