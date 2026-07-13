import globalThis from "../internals/global-this";
import shared from "../internals/shared-store";
import isCallable from "../internals/is-callable";
import create from "../internals/object-create";
import getPrototypeOf from "../internals/object-get-prototype-of";
import defineBuiltIn from "../internals/define-built-in";
import wellKnownSymbol from "../internals/well-known-symbol";
import IS_PURE from "../internals/is-pure";
var USE_FUNCTION_CONSTRUCTOR = 'USE_FUNCTION_CONSTRUCTOR';
var ASYNC_ITERATOR = wellKnownSymbol('asyncIterator');
var AsyncIterator = globalThis.AsyncIterator;
var PassedAsyncIteratorPrototype = shared.AsyncIteratorPrototype;
var AsyncIteratorPrototype, prototype;
if (PassedAsyncIteratorPrototype) {
  AsyncIteratorPrototype = PassedAsyncIteratorPrototype;
} else if (isCallable(AsyncIterator)) {
  AsyncIteratorPrototype = AsyncIterator.prototype;
} else if (shared[USE_FUNCTION_CONSTRUCTOR] || globalThis[USE_FUNCTION_CONSTRUCTOR]) {
  try {
    // eslint-disable-next-line no-new-func -- we have no alternatives without usage of modern syntax
    prototype = getPrototypeOf(getPrototypeOf(getPrototypeOf(Function('return async function*(){}()')())));
    if (getPrototypeOf(prototype) === Object.prototype) AsyncIteratorPrototype = prototype;
  } catch (error) {/* empty */}
}
if (!AsyncIteratorPrototype) AsyncIteratorPrototype = {};else if (IS_PURE) AsyncIteratorPrototype = create(AsyncIteratorPrototype);
if (!isCallable(AsyncIteratorPrototype[ASYNC_ITERATOR])) {
  defineBuiltIn(AsyncIteratorPrototype, ASYNC_ITERATOR, function () {
    return this;
  });
}
const _cjs_default = AsyncIteratorPrototype;
export default _cjs_default;
