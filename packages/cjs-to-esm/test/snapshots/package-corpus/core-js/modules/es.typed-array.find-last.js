import { aTypedArray as _aTypedArray, exportTypedArrayMethod as _exportTypedArrayMethod } from "../internals/array-buffer-view-core";
import { findLast as _findLast } from "../internals/array-iteration-from-last";
var $findLast = _findLast;
var aTypedArray = _aTypedArray;
var exportTypedArrayMethod = _exportTypedArrayMethod;

// `%TypedArray%.prototype.findLast` method
// https://tc39.es/ecma262/#sec-%typedarray%.prototype.findlast
exportTypedArrayMethod('findLast', function findLast(predicate /* , thisArg */) {
  return $findLast(aTypedArray(this), predicate, arguments.length > 1 ? arguments[1] : undefined);
});
const _cjs_default = {};
export default _cjs_default;
