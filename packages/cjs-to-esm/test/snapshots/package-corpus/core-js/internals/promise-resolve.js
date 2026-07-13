import anObject from "../internals/an-object";
import isObject from "../internals/is-object";
import { f as _f } from "../internals/new-promise-capability";
const _cjs_default = function (C, x) {
  anObject(C);
  if (isObject(x) && x.constructor === C) return x;
  var promiseCapability = _f(C);
  var resolve = promiseCapability.resolve;
  resolve(x);
  return promiseCapability.promise;
};
export default _cjs_default;
