import fails from "../internals/fails";
import isCallable from "../internals/is-callable";
import isObject from "../internals/is-object";
import create from "../internals/object-create";
import getPrototypeOf from "../internals/object-get-prototype-of";
import defineBuiltIn from "../internals/define-built-in";
import wellKnownSymbol from "../internals/well-known-symbol";
import IS_PURE from "../internals/is-pure";
var ITERATOR = wellKnownSymbol('iterator');
var BUGGY_SAFARI_ITERATORS = false;

// `%IteratorPrototype%` object
// https://tc39.es/ecma262/#sec-%iteratorprototype%-object
var IteratorPrototype, PrototypeOfArrayIteratorPrototype, arrayIterator;

/* eslint-disable es/no-array-prototype-keys -- safe */
if ([].keys) {
  arrayIterator = [].keys();
  // Safari 8 has buggy iterators w/o `next`
  if (!('next' in arrayIterator)) BUGGY_SAFARI_ITERATORS = true;else {
    PrototypeOfArrayIteratorPrototype = getPrototypeOf(getPrototypeOf(arrayIterator));
    if (PrototypeOfArrayIteratorPrototype !== Object.prototype) IteratorPrototype = PrototypeOfArrayIteratorPrototype;
  }
}
var NEW_ITERATOR_PROTOTYPE = !isObject(IteratorPrototype) || fails(function () {
  var test = {};
  // FF44- legacy iterators case
  return IteratorPrototype[ITERATOR].call(test) !== test;
});
if (NEW_ITERATOR_PROTOTYPE) IteratorPrototype = {};else if (IS_PURE) IteratorPrototype = create(IteratorPrototype);

// `%IteratorPrototype%[@@iterator]()` method
// https://tc39.es/ecma262/#sec-%iteratorprototype%-@@iterator
if (!isCallable(IteratorPrototype[ITERATOR])) {
  defineBuiltIn(IteratorPrototype, ITERATOR, function () {
    return this;
  });
}
const _cjs_default = {
  IteratorPrototype: IteratorPrototype,
  BUGGY_SAFARI_ITERATORS: BUGGY_SAFARI_ITERATORS
};
const _IteratorPrototype = _cjs_default["IteratorPrototype"];
export { _IteratorPrototype as IteratorPrototype };
const _BUGGY_SAFARI_ITERATORS = _cjs_default["BUGGY_SAFARI_ITERATORS"];
export { _BUGGY_SAFARI_ITERATORS as BUGGY_SAFARI_ITERATORS };
export default _cjs_default;
