import { aTypedArray as _aTypedArray, exportTypedArrayMethod as _exportTypedArrayMethod } from "../internals/array-buffer-view-core";
import { findIndex as _findIndex } from "../internals/array-iteration";
var $findIndex = _findIndex;
var aTypedArray = _aTypedArray;
var exportTypedArrayMethod = _exportTypedArrayMethod;

// `%TypedArray%.prototype.findIndex` method
// https://tc39.es/ecma262/#sec-%typedarray%.prototype.findindex
exportTypedArrayMethod('findIndex', function findIndex(predicate /* , thisArg */) {
  return $findIndex(aTypedArray(this), predicate, arguments.length > 1 ? arguments[1] : undefined);
});
const _cjs_default = {};
export default _cjs_default;
