import bind from "../internals/function-bind-context";
import call from "../internals/function-call";
import aCallable from "../internals/a-callable";
import aConstructor from "../internals/a-constructor";
import toObject from "../internals/to-object";
import lengthOfArrayLike from "../internals/length-of-array-like";
import getIterator from "../internals/get-iterator";
import getIteratorMethod from "../internals/get-iterator-method";
import isArrayIteratorMethod from "../internals/is-array-iterator-method";
import isBigIntArray from "../internals/is-big-int-array";
import { aTypedArrayConstructor as _aTypedArrayConstructor } from "../internals/array-buffer-view-core";
import toBigInt from "../internals/to-big-int";
var aTypedArrayConstructor = _aTypedArrayConstructor;
const _cjs_default = function from(source /* , mapfn, thisArg */) {
  var C = aConstructor(this);
  var argumentsLength = arguments.length;
  var mapfn = argumentsLength > 1 ? arguments[1] : undefined;
  var mapping = mapfn !== undefined;
  if (mapping) aCallable(mapfn);
  var O = toObject(source);
  var iteratorMethod = getIteratorMethod(O);
  var i, length, result, thisIsBigIntArray, value, step, iterator, next;
  if (iteratorMethod && !isArrayIteratorMethod(iteratorMethod)) {
    iterator = getIterator(O, iteratorMethod);
    next = iterator.next;
    O = [];
    while (!(step = call(next, iterator)).done) {
      O.push(step.value);
    }
  }
  if (mapping && argumentsLength > 2) {
    mapfn = bind(mapfn, arguments[2]);
  }
  length = lengthOfArrayLike(O);
  result = new (aTypedArrayConstructor(C))(length);
  thisIsBigIntArray = isBigIntArray(result);
  for (i = 0; length > i; i++) {
    value = mapping ? mapfn(O[i], i) : O[i];
    // FF30- typed arrays doesn't properly convert objects to typed array values
    result[i] = thisIsBigIntArray ? toBigInt(value) : +value;
  }
  return result;
};
export default _cjs_default;
