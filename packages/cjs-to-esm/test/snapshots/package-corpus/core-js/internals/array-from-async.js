import bind from "../internals/function-bind-context";
import uncurryThis from "../internals/function-uncurry-this";
import isConstructor from "../internals/is-constructor";
import getAsyncIterator from "../internals/get-async-iterator";
import getIterator from "../internals/get-iterator";
import getIteratorDirect from "../internals/get-iterator-direct";
import getIteratorMethod from "../internals/get-iterator-method";
import getMethod from "../internals/get-method";
import getBuiltIn from "../internals/get-built-in";
import getBuiltInPrototypeMethod from "../internals/get-built-in-prototype-method";
import wellKnownSymbol from "../internals/well-known-symbol";
import AsyncFromSyncIterator from "../internals/async-from-sync-iterator";
import { toArray as _toArray } from "../internals/async-iterator-iteration";
var toArray = _toArray;
var ASYNC_ITERATOR = wellKnownSymbol('asyncIterator');
var arrayIterator = uncurryThis(getBuiltInPrototypeMethod('Array', 'values'));
var arrayIteratorNext = uncurryThis(arrayIterator([]).next);
var safeArrayIterator = function () {
  return new SafeArrayIterator(this);
};
var SafeArrayIterator = function (O) {
  this.iterator = arrayIterator(O);
};
SafeArrayIterator.prototype.next = function () {
  return arrayIteratorNext(this.iterator);
};

// `Array.fromAsync` method implementation
// https://github.com/tc39/proposal-array-from-async
const _cjs_default = function fromAsync(items /* , mapfn = undefined, thisArg = undefined */) {
  var C = this;
  var argumentsLength = arguments.length;
  var mapfn = argumentsLength > 1 ? arguments[1] : undefined;
  var thisArg = argumentsLength > 2 ? arguments[2] : undefined;
  return new (getBuiltIn('Promise'))(function (resolve) {
    if (mapfn !== undefined) mapfn = bind(mapfn, thisArg);
    var usingAsyncIterator = getMethod(items, ASYNC_ITERATOR);
    var usingSyncIterator = usingAsyncIterator ? undefined : getIteratorMethod(items) || safeArrayIterator;
    var A = isConstructor(C) ? new C() : [];
    var iterator = usingAsyncIterator ? getAsyncIterator(items, usingAsyncIterator) : new AsyncFromSyncIterator(getIteratorDirect(getIterator(items, usingSyncIterator)));
    resolve(toArray(iterator, mapfn, A));
  });
};
export default _cjs_default;
