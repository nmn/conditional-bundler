import $ from "../internals/export";
import demethodize from "../internals/function-demethodize";
// `Function.prototype.unThis` method
// https://github.com/js-choi/proposal-function-demethodize
// TODO: Remove from `core-js@4`
$({
  target: 'Function',
  proto: true,
  forced: true,
  name: 'demethodize'
}, {
  unThis: demethodize
});
const _cjs_default = {};
export default _cjs_default;
