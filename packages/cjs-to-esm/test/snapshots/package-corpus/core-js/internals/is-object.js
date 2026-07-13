import isCallable from "../internals/is-callable";
const _cjs_default = function (it) {
  return typeof it == 'object' ? it !== null : isCallable(it);
};
export default _cjs_default;
