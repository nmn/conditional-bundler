import $ from "../internals/export";
import demethodize from "../internals/function-demethodize";
// `Function.prototype.demethodize` method
// https://github.com/js-choi/proposal-function-demethodize
$({
  target: 'Function',
  proto: true,
  forced: true
}, {
  demethodize: demethodize
});
const _cjs_default = {};
export default _cjs_default;
