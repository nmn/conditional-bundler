import bind from "../internals/function-bind-context";
import call from "../internals/function-call";
import toObject from "../internals/to-object";
import callWithSafeIterationClosing from "../internals/call-with-safe-iteration-closing";
import isArrayIteratorMethod from "../internals/is-array-iterator-method";
import isConstructor from "../internals/is-constructor";
import lengthOfArrayLike from "../internals/length-of-array-like";
import createProperty from "../internals/create-property";
import setArrayLength from "../internals/array-set-length";
import getIterator from "../internals/get-iterator";
import getIteratorMethod from "../internals/get-iterator-method";
import iteratorClose from "../internals/iterator-close";
var $Array = Array;

// `Array.from` method implementation
// https://tc39.es/ecma262/#sec-array.from
const _cjs_default = function from(arrayLike /* , mapfn = undefined, thisArg = undefined */) {
  var IS_CONSTRUCTOR = isConstructor(this);
  var argumentsLength = arguments.length;
  var mapfn = argumentsLength > 1 ? arguments[1] : undefined;
  var mapping = mapfn !== undefined;
  if (mapping) mapfn = bind(mapfn, argumentsLength > 2 ? arguments[2] : undefined);
  var O = toObject(arrayLike);
  var iteratorMethod = getIteratorMethod(O);
  var index = 0;
  var length, result, step, iterator, next, value;
  // if the target is not iterable or it's an array with the default iterator - use a simple case
  if (iteratorMethod && !(this === $Array && isArrayIteratorMethod(iteratorMethod))) {
    result = IS_CONSTRUCTOR ? new this() : [];
    iterator = getIterator(O, iteratorMethod);
    next = iterator.next;
    for (; !(step = call(next, iterator)).done; index++) {
      value = mapping ? callWithSafeIterationClosing(iterator, mapfn, [step.value, index], true) : step.value;
      try {
        createProperty(result, index, value);
      } catch (error) {
        iteratorClose(iterator, 'throw', error);
      }
    }
  } else {
    length = lengthOfArrayLike(O);
    result = IS_CONSTRUCTOR ? new this(length) : $Array(length);
    for (; length > index; index++) {
      value = mapping ? mapfn(O[index], index) : O[index];
      createProperty(result, index, value);
    }
  }
  setArrayLength(result, index);
  return result;
};
export default _cjs_default;
