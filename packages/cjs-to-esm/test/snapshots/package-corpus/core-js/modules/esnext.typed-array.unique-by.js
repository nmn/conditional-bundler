import uncurryThis from "../internals/function-uncurry-this";
import { aTypedArray as _aTypedArray, getTypedArrayConstructor as _getTypedArrayConstructor, exportTypedArrayMethod as _exportTypedArrayMethod } from "../internals/array-buffer-view-core";
import arrayFromConstructorAndList from "../internals/array-from-constructor-and-list";
import $arrayUniqueBy from "../internals/array-unique-by";
var aTypedArray = _aTypedArray;
var getTypedArrayConstructor = _getTypedArrayConstructor;
var exportTypedArrayMethod = _exportTypedArrayMethod;
var arrayUniqueBy = uncurryThis($arrayUniqueBy);

// `%TypedArray%.prototype.uniqueBy` method
// https://github.com/tc39/proposal-array-unique
exportTypedArrayMethod('uniqueBy', function uniqueBy(resolver) {
  aTypedArray(this);
  return arrayFromConstructorAndList(getTypedArrayConstructor(this), arrayUniqueBy(this, resolver));
}, true);
const _cjs_default = {};
export default _cjs_default;
