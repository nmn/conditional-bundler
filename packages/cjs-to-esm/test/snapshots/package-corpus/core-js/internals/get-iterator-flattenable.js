import call from "../internals/function-call";
import anObject from "../internals/an-object";
import getIteratorDirect from "../internals/get-iterator-direct";
import getIteratorMethod from "../internals/get-iterator-method";
const _cjs_default = function (obj, stringHandling) {
  if (!stringHandling || typeof obj !== 'string') anObject(obj);
  var method = getIteratorMethod(obj);
  return getIteratorDirect(anObject(method !== undefined ? call(method, obj) : obj));
};
export default _cjs_default;
