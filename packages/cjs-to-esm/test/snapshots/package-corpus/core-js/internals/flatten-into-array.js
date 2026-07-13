import isArray from "../internals/is-array";
import lengthOfArrayLike from "../internals/length-of-array-like";
import doesNotExceedSafeInteger from "../internals/does-not-exceed-safe-integer";
import bind from "../internals/function-bind-context";
import createProperty from "../internals/create-property";
// `FlattenIntoArray` abstract operation
// https://tc39.es/ecma262/#sec-flattenintoarray
var flattenIntoArray = function (target, original, source, sourceLen, start, depth, mapper, thisArg) {
  var targetIndex = start;
  var sourceIndex = 0;
  var mapFn = mapper ? bind(mapper, thisArg) : false;
  var element, elementLen;
  while (sourceIndex < sourceLen) {
    if (sourceIndex in source) {
      element = mapFn ? mapFn(source[sourceIndex], sourceIndex, original) : source[sourceIndex];
      if (depth > 0 && isArray(element)) {
        elementLen = lengthOfArrayLike(element);
        targetIndex = flattenIntoArray(target, original, element, elementLen, targetIndex, depth - 1) - 1;
      } else {
        doesNotExceedSafeInteger(targetIndex + 1);
        createProperty(target, targetIndex, element);
      }
      targetIndex++;
    }
    sourceIndex++;
  }
  return targetIndex;
};
const _cjs_default = flattenIntoArray;
export default _cjs_default;
