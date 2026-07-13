import call from "../internals/function-call";
import isCallable from "../internals/is-callable";
import anObject from "../internals/an-object";
import getIteratorDirect from "../internals/get-iterator-direct";
import getIteratorMethod from "../internals/get-iterator-method";
import getMethod from "../internals/get-method";
import wellKnownSymbol from "../internals/well-known-symbol";
import AsyncFromSyncIterator from "../internals/async-from-sync-iterator";
var ASYNC_ITERATOR = wellKnownSymbol('asyncIterator');
const _cjs_default = function (obj) {
  var object = anObject(obj);
  var alreadyAsync = true;
  var method = getMethod(object, ASYNC_ITERATOR);
  var iterator;
  if (!isCallable(method)) {
    method = getIteratorMethod(object);
    alreadyAsync = false;
  }
  if (method !== undefined) {
    iterator = call(method, object);
  } else {
    iterator = object;
    alreadyAsync = true;
  }
  anObject(iterator);
  return getIteratorDirect(alreadyAsync ? iterator : new AsyncFromSyncIterator(getIteratorDirect(iterator)));
};
export default _cjs_default;
