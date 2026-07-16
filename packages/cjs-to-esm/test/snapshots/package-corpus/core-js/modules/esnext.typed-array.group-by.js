import ArrayBufferViewCore from "../internals/array-buffer-view-core";
import $group from "../internals/array-group";
// TODO: Remove from `core-js@4`

var aTypedArray = ArrayBufferViewCore.aTypedArray;
var getTypedArrayConstructor = ArrayBufferViewCore.getTypedArrayConstructor;
var exportTypedArrayMethod = ArrayBufferViewCore.exportTypedArrayMethod;

// `%TypedArray%.prototype.groupBy` method
// https://github.com/tc39/proposal-array-grouping
exportTypedArrayMethod('groupBy', function groupBy(callbackfn /* , thisArg */) {
  var thisArg = arguments.length > 1 ? arguments[1] : undefined;
  return $group(aTypedArray(this), callbackfn, thisArg, getTypedArrayConstructor);
}, true);
const _cjs_default = {};
export default _cjs_default;
