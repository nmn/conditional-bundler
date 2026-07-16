import anObject from "../internals/an-object";
import isObject from "../internals/is-object";
import newPromiseCapability from "../internals/new-promise-capability";
const _cjs_default = function (C, x) {
  anObject(C);
  if (isObject(x) && x.constructor === C) return x;
  var promiseCapability = newPromiseCapability.f(C);
  var resolve = promiseCapability.resolve;
  resolve(x);
  return promiseCapability.promise;
};
export default _cjs_default;
