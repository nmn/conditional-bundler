import uncurryThis from "../internals/function-uncurry-this";
import ArrayBufferViewCore from "../internals/array-buffer-view-core";
import arrayFromConstructorAndList from "../internals/array-from-constructor-and-list";
import $arrayUniqueBy from "../internals/array-unique-by";
var aTypedArray = ArrayBufferViewCore.aTypedArray;
var getTypedArrayConstructor = ArrayBufferViewCore.getTypedArrayConstructor;
var exportTypedArrayMethod = ArrayBufferViewCore.exportTypedArrayMethod;
var arrayUniqueBy = uncurryThis($arrayUniqueBy);

// `%TypedArray%.prototype.uniqueBy` method
// https://github.com/tc39/proposal-array-unique
exportTypedArrayMethod('uniqueBy', function uniqueBy(resolver) {
  aTypedArray(this);
  return arrayFromConstructorAndList(getTypedArrayConstructor(this), arrayUniqueBy(this, resolver));
}, true);
const _cjs_default = {};
export default _cjs_default;
