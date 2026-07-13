import { aTypedArray as _aTypedArray, getTypedArrayConstructor as _getTypedArrayConstructor, exportTypedArrayMethod as _exportTypedArrayMethod } from "../internals/array-buffer-view-core";
import fails from "../internals/fails";
import arraySlice from "../internals/array-slice";
var aTypedArray = _aTypedArray;
var getTypedArrayConstructor = _getTypedArrayConstructor;
var exportTypedArrayMethod = _exportTypedArrayMethod;
var FORCED = fails(function () {
  // eslint-disable-next-line es/no-typed-arrays -- required for testing
  new Int8Array(1).slice();
});

// `%TypedArray%.prototype.slice` method
// https://tc39.es/ecma262/#sec-%typedarray%.prototype.slice
exportTypedArrayMethod('slice', function slice(start, end) {
  var list = arraySlice(aTypedArray(this), start, end);
  var C = getTypedArrayConstructor(this);
  var index = 0;
  var length = list.length;
  var result = new C(length);
  while (length > index) result[index] = list[index++];
  return result;
}, FORCED);
const _cjs_default = {};
export default _cjs_default;
