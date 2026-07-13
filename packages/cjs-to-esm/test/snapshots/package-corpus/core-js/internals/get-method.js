import aCallable from "../internals/a-callable";
import isNullOrUndefined from "../internals/is-null-or-undefined";
// `GetMethod` abstract operation
// https://tc39.es/ecma262/#sec-getmethod
const _cjs_default = function (V, P) {
  var func = V[P];
  return isNullOrUndefined(func) ? undefined : aCallable(func);
};
export default _cjs_default;
