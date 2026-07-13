import $ from "../internals/export";
import globalThis from "../internals/global-this";
import anInstance from "../internals/an-instance";
import anObject from "../internals/an-object";
import isCallable from "../internals/is-callable";
import getPrototypeOf from "../internals/object-get-prototype-of";
import defineBuiltInAccessor from "../internals/define-built-in-accessor";
import createProperty from "../internals/create-property";
import fails from "../internals/fails";
import hasOwn from "../internals/has-own-property";
import wellKnownSymbol from "../internals/well-known-symbol";
import { IteratorPrototype as _IteratorPrototype } from "../internals/iterators-core";
import DESCRIPTORS from "../internals/descriptors";
import IS_PURE from "../internals/is-pure";
var IteratorPrototype = _IteratorPrototype;
var CONSTRUCTOR = 'constructor';
var ITERATOR = 'Iterator';
var TO_STRING_TAG = wellKnownSymbol('toStringTag');
var $TypeError = TypeError;
var NativeIterator = globalThis[ITERATOR];

// FF56- have non-standard global helper `Iterator`
var FORCED = IS_PURE || !isCallable(NativeIterator) || NativeIterator.prototype !== IteratorPrototype
// FF44- non-standard `Iterator` passes previous tests
|| !fails(function () {
  NativeIterator({});
});
var IteratorConstructor = function Iterator() {
  anInstance(this, IteratorPrototype);
  if (getPrototypeOf(this) === IteratorPrototype) throw new $TypeError('Abstract class Iterator not directly constructable');
};
var defineIteratorPrototypeAccessor = function (key, value) {
  if (DESCRIPTORS) {
    defineBuiltInAccessor(IteratorPrototype, key, {
      configurable: true,
      get: function () {
        return value;
      },
      set: function (replacement) {
        anObject(this);
        if (this === IteratorPrototype) throw new $TypeError("You can't redefine this property");
        if (hasOwn(this, key)) this[key] = replacement;else createProperty(this, key, replacement);
      }
    });
  } else IteratorPrototype[key] = value;
};
if (!hasOwn(IteratorPrototype, TO_STRING_TAG)) defineIteratorPrototypeAccessor(TO_STRING_TAG, ITERATOR);
if (FORCED || !hasOwn(IteratorPrototype, CONSTRUCTOR) || IteratorPrototype[CONSTRUCTOR] === Object) {
  defineIteratorPrototypeAccessor(CONSTRUCTOR, IteratorConstructor);
}
IteratorConstructor.prototype = IteratorPrototype;

// `Iterator` constructor
// https://tc39.es/ecma262/#sec-iterator
$({
  global: true,
  constructor: true,
  forced: FORCED
}, {
  Iterator: IteratorConstructor
});
const _cjs_default = {};
export default _cjs_default;
