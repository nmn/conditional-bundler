import call from "../internals/function-call";
import AsyncFromSyncIterator from "../internals/async-from-sync-iterator";
import anObject from "../internals/an-object";
import getIterator from "../internals/get-iterator";
import getIteratorDirect from "../internals/get-iterator-direct";
import getMethod from "../internals/get-method";
import wellKnownSymbol from "../internals/well-known-symbol";
var ASYNC_ITERATOR = wellKnownSymbol('asyncIterator');
const _cjs_default = function (it, usingIterator) {
  var method = arguments.length < 2 ? getMethod(it, ASYNC_ITERATOR) : usingIterator;
  return method ? anObject(call(method, it)) : new AsyncFromSyncIterator(getIteratorDirect(getIterator(it)));
};
export default _cjs_default;
