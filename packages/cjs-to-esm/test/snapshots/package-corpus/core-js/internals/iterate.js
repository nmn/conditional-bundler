import bind from "../internals/function-bind-context";
import call from "../internals/function-call";
import anObject from "../internals/an-object";
import tryToString from "../internals/try-to-string";
import isArrayIteratorMethod from "../internals/is-array-iterator-method";
import lengthOfArrayLike from "../internals/length-of-array-like";
import isPrototypeOf from "../internals/object-is-prototype-of";
import getIterator from "../internals/get-iterator";
import getIteratorMethod from "../internals/get-iterator-method";
import iteratorClose from "../internals/iterator-close";
var $TypeError = TypeError;
var Result = function (stopped, result) {
  this.stopped = stopped;
  this.result = result;
};
var ResultPrototype = Result.prototype;
const _cjs_default = function (iterable, unboundFunction, options) {
  var that = options && options.that;
  var AS_ENTRIES = !!(options && options.AS_ENTRIES);
  var IS_RECORD = !!(options && options.IS_RECORD);
  var IS_ITERATOR = !!(options && options.IS_ITERATOR);
  var INTERRUPTED = !!(options && options.INTERRUPTED);
  var fn = bind(unboundFunction, that);
  var iterator, iterFn, index, length, result, next, step;
  var stop = function (condition) {
    var $iterator = iterator;
    iterator = undefined;
    if ($iterator) iteratorClose($iterator, 'normal');
    return new Result(true, condition);
  };
  var callFn = function (value) {
    if (AS_ENTRIES) {
      anObject(value);
      return INTERRUPTED ? fn(value[0], value[1], stop) : fn(value[0], value[1]);
    }
    return INTERRUPTED ? fn(value, stop) : fn(value);
  };
  if (IS_RECORD) {
    iterator = iterable.iterator;
  } else if (IS_ITERATOR) {
    iterator = iterable;
  } else {
    iterFn = getIteratorMethod(iterable);
    if (!iterFn) throw new $TypeError(tryToString(iterable) + ' is not iterable');
    // optimisation for array iterators
    if (isArrayIteratorMethod(iterFn)) {
      for (index = 0, length = lengthOfArrayLike(iterable); length > index; index++) {
        result = callFn(iterable[index]);
        if (result && isPrototypeOf(ResultPrototype, result)) return result;
      }
      return new Result(false);
    }
    iterator = getIterator(iterable, iterFn);
  }
  next = IS_RECORD ? iterable.next : iterator.next;
  while (!(step = call(next, iterator)).done) {
    // `IteratorValue` errors should propagate without closing the iterator
    var value = step.value;
    try {
      result = callFn(value);
    } catch (error) {
      if (iterator) iteratorClose(iterator, 'throw', error);else throw error;
    }
    if (typeof result == 'object' && result && isPrototypeOf(ResultPrototype, result)) return result;
  }
  return new Result(false);
};
export default _cjs_default;
