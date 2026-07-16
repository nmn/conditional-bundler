import ArrayBufferViewCore from "../internals/array-buffer-view-core";
import TYPED_ARRAYS_CONSTRUCTORS_REQUIRES_WRAPPERS from "../internals/typed-array-constructors-require-wrappers";
var aTypedArrayConstructor = ArrayBufferViewCore.aTypedArrayConstructor;
var exportTypedArrayStaticMethod = ArrayBufferViewCore.exportTypedArrayStaticMethod;

// `%TypedArray%.of` method
// https://tc39.es/ecma262/#sec-%typedarray%.of
exportTypedArrayStaticMethod('of', function of(/* ...items */
) {
  var index = 0;
  var length = arguments.length;
  var result = new (aTypedArrayConstructor(this))(length);
  while (length > index) result[index] = arguments[index++];
  return result;
}, TYPED_ARRAYS_CONSTRUCTORS_REQUIRES_WRAPPERS);
const _cjs_default = {};
export default _cjs_default;
