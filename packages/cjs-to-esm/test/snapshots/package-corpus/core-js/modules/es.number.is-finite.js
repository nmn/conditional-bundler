import $ from "../internals/export";
import numberIsFinite from "../internals/number-is-finite";
// `Number.isFinite` method
// https://tc39.es/ecma262/#sec-number.isfinite
$({
  target: 'Number',
  stat: true
}, {
  isFinite: numberIsFinite
});
const _cjs_default = {};
export default _cjs_default;
