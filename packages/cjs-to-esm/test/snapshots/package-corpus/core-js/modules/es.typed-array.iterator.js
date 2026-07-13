import globalThis from "../internals/global-this";
import fails from "../internals/fails";
import uncurryThis from "../internals/function-uncurry-this";
import { aTypedArray as _aTypedArray, exportTypedArrayMethod as _exportTypedArrayMethod } from "../internals/array-buffer-view-core";
import ArrayIterators from "../modules/es.array.iterator";
import wellKnownSymbol from "../internals/well-known-symbol";
var ITERATOR = wellKnownSymbol('iterator');
var Uint8Array = globalThis.Uint8Array;
var arrayValues = uncurryThis(ArrayIterators.values);
var arrayKeys = uncurryThis(ArrayIterators.keys);
var arrayEntries = uncurryThis(ArrayIterators.entries);
var aTypedArray = _aTypedArray;
var exportTypedArrayMethod = _exportTypedArrayMethod;
var TypedArrayPrototype = Uint8Array && Uint8Array.prototype;
var GENERIC = !fails(function () {
  TypedArrayPrototype[ITERATOR].call([1]);
});
var ITERATOR_IS_VALUES = !!TypedArrayPrototype && TypedArrayPrototype.values && TypedArrayPrototype[ITERATOR] === TypedArrayPrototype.values && TypedArrayPrototype.values.name === 'values';
var typedArrayValues = function values() {
  return arrayValues(aTypedArray(this));
};

// `%TypedArray%.prototype.entries` method
// https://tc39.es/ecma262/#sec-%typedarray%.prototype.entries
exportTypedArrayMethod('entries', function entries() {
  return arrayEntries(aTypedArray(this));
}, GENERIC);
// `%TypedArray%.prototype.keys` method
// https://tc39.es/ecma262/#sec-%typedarray%.prototype.keys
exportTypedArrayMethod('keys', function keys() {
  return arrayKeys(aTypedArray(this));
}, GENERIC);
// `%TypedArray%.prototype.values` method
// https://tc39.es/ecma262/#sec-%typedarray%.prototype.values
exportTypedArrayMethod('values', typedArrayValues, GENERIC || !ITERATOR_IS_VALUES, {
  name: 'values'
});
// `%TypedArray%.prototype[@@iterator]` method
// https://tc39.es/ecma262/#sec-%typedarray%.prototype-@@iterator
exportTypedArrayMethod(ITERATOR, typedArrayValues, GENERIC || !ITERATOR_IS_VALUES, {
  name: 'values'
});
const _cjs_default = {};
export default _cjs_default;
