import lengthOfArrayLike from "../internals/length-of-array-like";
import { aTypedArray as _aTypedArray, exportTypedArrayMethod as _exportTypedArrayMethod, getTypedArrayConstructor as _getTypedArrayConstructor } from "../internals/array-buffer-view-core";
var aTypedArray = _aTypedArray;
var exportTypedArrayMethod = _exportTypedArrayMethod;
var getTypedArrayConstructor = _getTypedArrayConstructor;

// `%TypedArray%.prototype.toReversed` method
// https://tc39.es/ecma262/#sec-%typedarray%.prototype.toreversed
exportTypedArrayMethod('toReversed', function toReversed() {
  var O = aTypedArray(this);
  var len = lengthOfArrayLike(O);
  var A = new (getTypedArrayConstructor(O))(len);
  var k = 0;
  for (; k < len; k++) A[k] = O[len - k - 1];
  return A;
});
const _cjs_default = {};
export default _cjs_default;
