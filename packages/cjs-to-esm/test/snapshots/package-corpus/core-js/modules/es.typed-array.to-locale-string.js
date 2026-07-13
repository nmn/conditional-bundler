import globalThis from "../internals/global-this";
import apply from "../internals/function-apply";
import { aTypedArray as _aTypedArray, exportTypedArrayMethod as _exportTypedArrayMethod } from "../internals/array-buffer-view-core";
import fails from "../internals/fails";
import arraySlice from "../internals/array-slice";
var Int8Array = globalThis.Int8Array;
var aTypedArray = _aTypedArray;
var exportTypedArrayMethod = _exportTypedArrayMethod;
var $toLocaleString = [].toLocaleString;

// iOS Safari 6.x fails here
var TO_LOCALE_STRING_BUG = !!Int8Array && fails(function () {
  $toLocaleString.call(new Int8Array(1));
});
var FORCED = fails(function () {
  return [1, 2].toLocaleString() !== new Int8Array([1, 2]).toLocaleString();
}) || !fails(function () {
  Int8Array.prototype.toLocaleString.call([1, 2]);
});

// `%TypedArray%.prototype.toLocaleString` method
// https://tc39.es/ecma262/#sec-%typedarray%.prototype.tolocalestring
exportTypedArrayMethod('toLocaleString', function toLocaleString() {
  return apply($toLocaleString, TO_LOCALE_STRING_BUG ? arraySlice(aTypedArray(this)) : aTypedArray(this), arraySlice(arguments));
}, FORCED);
const _cjs_default = {};
export default _cjs_default;
