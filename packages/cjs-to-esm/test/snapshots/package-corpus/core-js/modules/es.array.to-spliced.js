import $ from "../internals/export";
import addToUnscopables from "../internals/add-to-unscopables";
import doesNotExceedSafeInteger from "../internals/does-not-exceed-safe-integer";
import lengthOfArrayLike from "../internals/length-of-array-like";
import toAbsoluteIndex from "../internals/to-absolute-index";
import toIndexedObject from "../internals/to-indexed-object";
import toIntegerOrInfinity from "../internals/to-integer-or-infinity";
import createProperty from "../internals/create-property";
var $Array = Array;
var max = Math.max;
var min = Math.min;

// `Array.prototype.toSpliced` method
// https://tc39.es/ecma262/#sec-array.prototype.tospliced
$({
  target: 'Array',
  proto: true
}, {
  toSpliced: function toSpliced(start, deleteCount /* , ...items */) {
    var O = toIndexedObject(this);
    var len = lengthOfArrayLike(O);
    var actualStart = toAbsoluteIndex(start, len);
    var argumentsLength = arguments.length;
    var k = 0;
    var insertCount, actualDeleteCount, newLen, A;
    if (argumentsLength === 0) {
      insertCount = actualDeleteCount = 0;
    } else if (argumentsLength === 1) {
      insertCount = 0;
      actualDeleteCount = len - actualStart;
    } else {
      insertCount = argumentsLength - 2;
      actualDeleteCount = min(max(toIntegerOrInfinity(deleteCount), 0), len - actualStart);
    }
    newLen = doesNotExceedSafeInteger(len + insertCount - actualDeleteCount);
    A = $Array(newLen);
    for (; k < actualStart; k++) createProperty(A, k, O[k]);
    for (; k < actualStart + insertCount; k++) createProperty(A, k, arguments[k - actualStart + 2]);
    for (; k < newLen; k++) createProperty(A, k, O[k + actualDeleteCount - insertCount]);
    return A;
  }
});
addToUnscopables('toSpliced');
const _cjs_default = {};
export default _cjs_default;
