import { aTypedArray as _aTypedArray, getTypedArrayConstructor as _getTypedArrayConstructor, exportTypedArrayMethod as _exportTypedArrayMethod } from "../internals/array-buffer-view-core";
import $group from "../internals/array-group";
// TODO: Remove from `core-js@4`

var aTypedArray = _aTypedArray;
var getTypedArrayConstructor = _getTypedArrayConstructor;
var exportTypedArrayMethod = _exportTypedArrayMethod;

// `%TypedArray%.prototype.groupBy` method
// https://github.com/tc39/proposal-array-grouping
exportTypedArrayMethod('groupBy', function groupBy(callbackfn /* , thisArg */) {
  var thisArg = arguments.length > 1 ? arguments[1] : undefined;
  return $group(aTypedArray(this), callbackfn, thisArg, getTypedArrayConstructor);
}, true);
const _cjs_default = {};
export default _cjs_default;
