import _cjs_import from "../internals/array-buffer-view-core";
import fails from "../internals/fails";
import globalThis from "../internals/global-this";
import uncurryThis from "../internals/function-uncurry-this";
var exportTypedArrayMethod = _cjs_import.exportTypedArrayMethod;
var Uint8Array = globalThis.Uint8Array;
var Uint8ArrayPrototype = Uint8Array && Uint8Array.prototype || {};
var arrayToString = [].toString;
var join = uncurryThis([].join);
if (fails(function () {
  arrayToString.call({});
})) {
  arrayToString = function toString() {
    return join(this);
  };
}
var IS_NOT_ARRAY_METHOD = Uint8ArrayPrototype.toString !== arrayToString;

// `%TypedArray%.prototype.toString` method
// https://tc39.es/ecma262/#sec-%typedarray%.prototype.tostring
exportTypedArrayMethod('toString', arrayToString, IS_NOT_ARRAY_METHOD);
const _cjs_default = {};
export default _cjs_default;
