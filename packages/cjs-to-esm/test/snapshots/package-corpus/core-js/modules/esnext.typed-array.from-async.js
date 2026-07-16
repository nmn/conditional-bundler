import getBuiltIn from "../internals/get-built-in";
import aConstructor from "../internals/a-constructor";
import arrayFromAsync from "../internals/array-from-async";
import ArrayBufferViewCore from "../internals/array-buffer-view-core";
import arrayFromConstructorAndList from "../internals/array-from-constructor-and-list";
// TODO: Remove from `core-js@4`

var aTypedArrayConstructor = ArrayBufferViewCore.aTypedArrayConstructor;
var exportTypedArrayStaticMethod = ArrayBufferViewCore.exportTypedArrayStaticMethod;

// `%TypedArray%.fromAsync` method
// https://github.com/tc39/proposal-array-from-async
exportTypedArrayStaticMethod('fromAsync', function fromAsync(asyncItems /* , mapfn = undefined, thisArg = undefined */) {
  var C = this;
  var argumentsLength = arguments.length;
  var mapfn = argumentsLength > 1 ? arguments[1] : undefined;
  var thisArg = argumentsLength > 2 ? arguments[2] : undefined;
  return new (getBuiltIn('Promise'))(function (resolve) {
    aConstructor(C);
    resolve(arrayFromAsync(asyncItems, mapfn, thisArg));
  }).then(function (list) {
    return arrayFromConstructorAndList(aTypedArrayConstructor(C), list);
  });
}, true);
const _cjs_default = {};
export default _cjs_default;
