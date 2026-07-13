import $ from "../internals/export";
import call from "../internals/function-call";
import IS_PURE from "../internals/is-pure";
import { PROPER as _PROPER, CONFIGURABLE as _CONFIGURABLE } from "../internals/function-name";
import isCallable from "../internals/is-callable";
import createIteratorConstructor from "../internals/iterator-create-constructor";
import getPrototypeOf from "../internals/object-get-prototype-of";
import setPrototypeOf from "../internals/object-set-prototype-of";
import setToStringTag from "../internals/set-to-string-tag";
import createNonEnumerableProperty from "../internals/create-non-enumerable-property";
import defineBuiltIn from "../internals/define-built-in";
import wellKnownSymbol from "../internals/well-known-symbol";
import Iterators from "../internals/iterators";
import { IteratorPrototype as _IteratorPrototype, BUGGY_SAFARI_ITERATORS as _BUGGY_SAFARI_ITERATORS } from "../internals/iterators-core";
var PROPER_FUNCTION_NAME = _PROPER;
var CONFIGURABLE_FUNCTION_NAME = _CONFIGURABLE;
var IteratorPrototype = _IteratorPrototype;
var BUGGY_SAFARI_ITERATORS = _BUGGY_SAFARI_ITERATORS;
var ITERATOR = wellKnownSymbol('iterator');
var KEYS = 'keys';
var VALUES = 'values';
var ENTRIES = 'entries';
var returnThis = function () {
  return this;
};
const _cjs_default = function (Iterable, NAME, IteratorConstructor, next, DEFAULT, IS_SET, FORCED) {
  createIteratorConstructor(IteratorConstructor, NAME, next);
  var getIterationMethod = function (KIND) {
    if (KIND === DEFAULT && defaultIterator) return defaultIterator;
    if (!BUGGY_SAFARI_ITERATORS && KIND && KIND in IterablePrototype) return IterablePrototype[KIND];
    switch (KIND) {
      case KEYS:
        return function keys() {
          return new IteratorConstructor(this, KIND);
        };
      case VALUES:
        return function values() {
          return new IteratorConstructor(this, KIND);
        };
      case ENTRIES:
        return function entries() {
          return new IteratorConstructor(this, KIND);
        };
    }
    return function () {
      return new IteratorConstructor(this);
    };
  };
  var TO_STRING_TAG = NAME + ' Iterator';
  var INCORRECT_VALUES_NAME = false;
  var IterablePrototype = Iterable.prototype;
  var nativeIterator = IterablePrototype[ITERATOR] || IterablePrototype['@@iterator'] || DEFAULT && IterablePrototype[DEFAULT];
  var defaultIterator = !BUGGY_SAFARI_ITERATORS && nativeIterator || getIterationMethod(DEFAULT);
  var anyNativeIterator = NAME === 'Array' ? IterablePrototype.entries || nativeIterator : nativeIterator;
  var CurrentIteratorPrototype, methods, KEY;

  // fix native
  if (anyNativeIterator) {
    CurrentIteratorPrototype = getPrototypeOf(anyNativeIterator.call(new Iterable()));
    if (CurrentIteratorPrototype !== Object.prototype && CurrentIteratorPrototype.next) {
      if (!IS_PURE && getPrototypeOf(CurrentIteratorPrototype) !== IteratorPrototype) {
        if (setPrototypeOf) {
          setPrototypeOf(CurrentIteratorPrototype, IteratorPrototype);
        } else if (!isCallable(CurrentIteratorPrototype[ITERATOR])) {
          defineBuiltIn(CurrentIteratorPrototype, ITERATOR, returnThis);
        }
      }
      // Set @@toStringTag to native iterators
      setToStringTag(CurrentIteratorPrototype, TO_STRING_TAG, true, true);
      if (IS_PURE) Iterators[TO_STRING_TAG] = returnThis;
    }
  }

  // fix Array.prototype.{ values, @@iterator }.name in V8 / FF
  if (PROPER_FUNCTION_NAME && DEFAULT === VALUES && nativeIterator && nativeIterator.name !== VALUES) {
    if (!IS_PURE && CONFIGURABLE_FUNCTION_NAME) {
      createNonEnumerableProperty(IterablePrototype, 'name', VALUES);
    } else {
      INCORRECT_VALUES_NAME = true;
      defaultIterator = function values() {
        return call(nativeIterator, this);
      };
    }
  }

  // export additional methods
  if (DEFAULT) {
    methods = {
      values: getIterationMethod(VALUES),
      keys: IS_SET ? defaultIterator : getIterationMethod(KEYS),
      entries: getIterationMethod(ENTRIES)
    };
    if (FORCED) for (KEY in methods) {
      if (BUGGY_SAFARI_ITERATORS || INCORRECT_VALUES_NAME || !(KEY in IterablePrototype)) {
        defineBuiltIn(IterablePrototype, KEY, methods[KEY]);
      }
    } else $({
      target: NAME,
      proto: true,
      forced: BUGGY_SAFARI_ITERATORS || INCORRECT_VALUES_NAME
    }, methods);
  }

  // define iterator
  if ((!IS_PURE || FORCED) && IterablePrototype[ITERATOR] !== defaultIterator) {
    defineBuiltIn(IterablePrototype, ITERATOR, defaultIterator, {
      name: DEFAULT
    });
  }
  Iterators[NAME] = defaultIterator;
  return methods;
};
export default _cjs_default;
