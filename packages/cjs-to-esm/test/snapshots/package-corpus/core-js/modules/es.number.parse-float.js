import $ from "../internals/export";
import parseFloat from "../internals/number-parse-float";
// `Number.parseFloat` method
// https://tc39.es/ecma262/#sec-number.parseFloat
// eslint-disable-next-line es/no-number-parsefloat -- required for testing
$({
  target: 'Number',
  stat: true,
  forced: Number.parseFloat !== parseFloat
}, {
  parseFloat: parseFloat
});
const _cjs_default = {};
export default _cjs_default;
