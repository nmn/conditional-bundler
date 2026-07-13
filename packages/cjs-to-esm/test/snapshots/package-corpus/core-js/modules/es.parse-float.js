import $ from "../internals/export";
import $parseFloat from "../internals/number-parse-float";
// `parseFloat` method
// https://tc39.es/ecma262/#sec-parsefloat-string
$({
  global: true,
  forced: parseFloat !== $parseFloat
}, {
  parseFloat: $parseFloat
});
const _cjs_default = {};
export default _cjs_default;
