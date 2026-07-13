import { aTypedArray as _aTypedArray, exportTypedArrayMethod as _exportTypedArrayMethod } from "../internals/array-buffer-view-core";
import lengthOfArrayLike from "../internals/length-of-array-like";
import toIntegerOrInfinity from "../internals/to-integer-or-infinity";
var aTypedArray = _aTypedArray;
var exportTypedArrayMethod = _exportTypedArrayMethod;

// `%TypedArray%.prototype.at` method
// https://tc39.es/ecma262/#sec-%typedarray%.prototype.at
exportTypedArrayMethod('at', function at(index) {
  var O = aTypedArray(this);
  var len = lengthOfArrayLike(O);
  var relativeIndex = toIntegerOrInfinity(index);
  var k = relativeIndex >= 0 ? relativeIndex : len + relativeIndex;
  return k < 0 || k >= len ? undefined : O[k];
});
const _cjs_default = {};
export default _cjs_default;
