import getBuiltIn from "../internals/get-built-in";
import isCallable from "../internals/is-callable";
import isIterable from "../internals/is-iterable";
import isObject from "../internals/is-object";
var Set = getBuiltIn('Set');
var isSetLike = function (it) {
  return isObject(it) && typeof it.size == 'number' && isCallable(it.has) && isCallable(it.keys);
};

// fallback old -> new set methods proposal arguments
const _cjs_default = function (it) {
  if (isSetLike(it)) return it;
  return isIterable(it) ? new Set(it) : it;
};
export default _cjs_default;
