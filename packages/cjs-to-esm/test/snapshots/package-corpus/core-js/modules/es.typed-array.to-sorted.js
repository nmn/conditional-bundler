import { aTypedArray as _aTypedArray, getTypedArrayConstructor as _getTypedArrayConstructor, exportTypedArrayMethod as _exportTypedArrayMethod, TypedArrayPrototype as _TypedArrayPrototype } from "../internals/array-buffer-view-core";
import uncurryThis from "../internals/function-uncurry-this";
import aCallable from "../internals/a-callable";
import arrayFromConstructorAndList from "../internals/array-from-constructor-and-list";
var aTypedArray = _aTypedArray;
var getTypedArrayConstructor = _getTypedArrayConstructor;
var exportTypedArrayMethod = _exportTypedArrayMethod;
var sort = uncurryThis(_TypedArrayPrototype.sort);

// `%TypedArray%.prototype.toSorted` method
// https://tc39.es/ecma262/#sec-%typedarray%.prototype.tosorted
exportTypedArrayMethod('toSorted', function toSorted(compareFn) {
  if (compareFn !== undefined) aCallable(compareFn);
  var O = aTypedArray(this);
  var A = arrayFromConstructorAndList(getTypedArrayConstructor(O), O);
  return sort(A, compareFn);
});
const _cjs_default = {};
export default _cjs_default;
