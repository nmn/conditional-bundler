import { aTypedArray as _aTypedArray, exportTypedArrayMethod as _exportTypedArrayMethod } from "../internals/array-buffer-view-core";
import { some as _some } from "../internals/array-iteration";
var $some = _some;
var aTypedArray = _aTypedArray;
var exportTypedArrayMethod = _exportTypedArrayMethod;

// `%TypedArray%.prototype.some` method
// https://tc39.es/ecma262/#sec-%typedarray%.prototype.some
exportTypedArrayMethod('some', function some(callbackfn /* , thisArg */) {
  return $some(aTypedArray(this), callbackfn, arguments.length > 1 ? arguments[1] : undefined);
});
const _cjs_default = {};
export default _cjs_default;
