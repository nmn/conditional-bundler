import { aTypedArray as _aTypedArray, getTypedArrayConstructor as _getTypedArrayConstructor, exportTypedArrayMethod as _exportTypedArrayMethod } from "../internals/array-buffer-view-core";
import isBigIntArray from "../internals/is-big-int-array";
import lengthOfArrayLike from "../internals/length-of-array-like";
import toIntegerOrInfinity from "../internals/to-integer-or-infinity";
import toBigInt from "../internals/to-big-int";
var aTypedArray = _aTypedArray;
var getTypedArrayConstructor = _getTypedArrayConstructor;
var exportTypedArrayMethod = _exportTypedArrayMethod;
var $RangeError = RangeError;
var PROPER_ORDER = function () {
  try {
    // eslint-disable-next-line no-throw-literal, es/no-typed-arrays, es/no-array-prototype-with -- required for testing
    new Int8Array(1)['with'](2, {
      valueOf: function () {
        throw 8;
      }
    });
  } catch (error) {
    // some early implementations, like WebKit, does not follow the final semantic
    // https://github.com/tc39/proposal-change-array-by-copy/pull/86
    return error === 8;
  }
}();

// Bug in WebKit. It should truncate a negative fractional index to zero, but instead throws an error
var THROW_ON_NEGATIVE_FRACTIONAL_INDEX = PROPER_ORDER && function () {
  try {
    // eslint-disable-next-line es/no-typed-arrays, es/no-array-prototype-with -- required for testing
    new Int8Array(1)['with'](-0.5, 1);
  } catch (error) {
    return true;
  }
}();

// `%TypedArray%.prototype.with` method
// https://tc39.es/ecma262/#sec-%typedarray%.prototype.with
exportTypedArrayMethod('with', {
  'with': function (index, value) {
    var O = aTypedArray(this);
    var len = lengthOfArrayLike(O);
    var relativeIndex = toIntegerOrInfinity(index);
    var actualIndex = relativeIndex < 0 ? len + relativeIndex : relativeIndex;
    var numericValue = isBigIntArray(O) ? toBigInt(value) : +value;
    if (actualIndex >= len || actualIndex < 0) throw new $RangeError('Incorrect index');
    var A = new (getTypedArrayConstructor(O))(len);
    var k = 0;
    for (; k < len; k++) A[k] = k === actualIndex ? numericValue : O[k];
    return A;
  }
}['with'], !PROPER_ORDER || THROW_ON_NEGATIVE_FRACTIONAL_INDEX);
const _cjs_default = {};
export default _cjs_default;
