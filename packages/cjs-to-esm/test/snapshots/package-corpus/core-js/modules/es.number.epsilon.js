import $ from "../internals/export";
// `Number.EPSILON` constant
// https://tc39.es/ecma262/#sec-number.epsilon
$({
  target: 'Number',
  stat: true,
  nonConfigurable: true,
  nonWritable: true
}, {
  EPSILON: Math.pow(2, -52)
});
const _cjs_default = {};
export default _cjs_default;
