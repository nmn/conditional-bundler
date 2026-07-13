import { aTypedArray as _aTypedArray, exportTypedArrayMethod as _exportTypedArrayMethod } from "../internals/array-buffer-view-core";
import { findLastIndex as _findLastIndex } from "../internals/array-iteration-from-last";
var $findLastIndex = _findLastIndex;
var aTypedArray = _aTypedArray;
var exportTypedArrayMethod = _exportTypedArrayMethod;

// `%TypedArray%.prototype.findLastIndex` method
// https://tc39.es/ecma262/#sec-%typedarray%.prototype.findlastindex
exportTypedArrayMethod('findLastIndex', function findLastIndex(predicate /* , thisArg */) {
  return $findLastIndex(aTypedArray(this), predicate, arguments.length > 1 ? arguments[1] : undefined);
});
const _cjs_default = {};
export default _cjs_default;
