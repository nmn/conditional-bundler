import ArrayBufferViewCore from "../internals/array-buffer-view-core";
import uncurryThis from "../internals/function-uncurry-this";
var aTypedArray = ArrayBufferViewCore.aTypedArray;
var exportTypedArrayMethod = ArrayBufferViewCore.exportTypedArrayMethod;
var $join = uncurryThis([].join);

// `%TypedArray%.prototype.join` method
// https://tc39.es/ecma262/#sec-%typedarray%.prototype.join
exportTypedArrayMethod('join', function join(separator) {
  return $join(aTypedArray(this), separator);
});
const _cjs_default = {};
export default _cjs_default;
