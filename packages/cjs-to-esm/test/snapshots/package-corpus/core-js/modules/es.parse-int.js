import $ from "../internals/export";
import $parseInt from "../internals/number-parse-int";
// `parseInt` method
// https://tc39.es/ecma262/#sec-parseint-string-radix
$({
  global: true,
  forced: parseInt !== $parseInt
}, {
  parseInt: $parseInt
});
const _cjs_default = {};
export default _cjs_default;
