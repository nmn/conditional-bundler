import { aTypedArray as _aTypedArray, getTypedArrayConstructor as _getTypedArrayConstructor, exportTypedArrayMethod as _exportTypedArrayMethod } from "../internals/array-buffer-view-core";
import toLength from "../internals/to-length";
import toAbsoluteIndex from "../internals/to-absolute-index";
var aTypedArray = _aTypedArray;
var getTypedArrayConstructor = _getTypedArrayConstructor;
var exportTypedArrayMethod = _exportTypedArrayMethod;

// `%TypedArray%.prototype.subarray` method
// https://tc39.es/ecma262/#sec-%typedarray%.prototype.subarray
exportTypedArrayMethod('subarray', function subarray(begin, end) {
  var O = aTypedArray(this);
  var length = O.length;
  var beginIndex = toAbsoluteIndex(begin, length);
  var C = getTypedArrayConstructor(O);
  return new C(O.buffer, O.byteOffset + beginIndex * O.BYTES_PER_ELEMENT, toLength((end === undefined ? length : toAbsoluteIndex(end, length)) - beginIndex));
});
const _cjs_default = {};
export default _cjs_default;
