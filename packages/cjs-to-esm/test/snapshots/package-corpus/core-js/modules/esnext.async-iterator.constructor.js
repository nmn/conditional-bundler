import $ from "../internals/export";
import anInstance from "../internals/an-instance";
import getPrototypeOf from "../internals/object-get-prototype-of";
import createNonEnumerableProperty from "../internals/create-non-enumerable-property";
import hasOwn from "../internals/has-own-property";
import wellKnownSymbol from "../internals/well-known-symbol";
import AsyncIteratorPrototype from "../internals/async-iterator-prototype";
import IS_PURE from "../internals/is-pure";
var TO_STRING_TAG = wellKnownSymbol('toStringTag');
var $TypeError = TypeError;
var AsyncIteratorConstructor = function AsyncIterator() {
  anInstance(this, AsyncIteratorPrototype);
  if (getPrototypeOf(this) === AsyncIteratorPrototype) throw new $TypeError('Abstract class AsyncIterator not directly constructable');
};
AsyncIteratorConstructor.prototype = AsyncIteratorPrototype;
if (!hasOwn(AsyncIteratorPrototype, TO_STRING_TAG)) {
  createNonEnumerableProperty(AsyncIteratorPrototype, TO_STRING_TAG, 'AsyncIterator');
}
if (IS_PURE || !hasOwn(AsyncIteratorPrototype, 'constructor') || AsyncIteratorPrototype.constructor === Object) {
  createNonEnumerableProperty(AsyncIteratorPrototype, 'constructor', AsyncIteratorConstructor);
}

// `AsyncIterator` constructor
// https://github.com/tc39/proposal-async-iterator-helpers
$({
  global: true,
  constructor: true,
  forced: IS_PURE
}, {
  AsyncIterator: AsyncIteratorConstructor
});
const _cjs_default = {};
export default _cjs_default;
