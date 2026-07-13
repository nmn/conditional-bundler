import $ from "../internals/export";
import cooked from "../internals/string-cooked";
// `String.cooked` method
// https://github.com/tc39/proposal-string-cooked
$({
  target: 'String',
  stat: true,
  forced: true
}, {
  cooked: cooked
});
const _cjs_default = {};
export default _cjs_default;
