import $ from "../internals/export";
import parseInt from "../internals/number-parse-int";
// `Number.parseInt` method
// https://tc39.es/ecma262/#sec-number.parseint
// eslint-disable-next-line es/no-number-parseint -- required for testing
$({
  target: 'Number',
  stat: true,
  forced: Number.parseInt !== parseInt
}, {
  parseInt: parseInt
});
const _cjs_default = {};
export default _cjs_default;
