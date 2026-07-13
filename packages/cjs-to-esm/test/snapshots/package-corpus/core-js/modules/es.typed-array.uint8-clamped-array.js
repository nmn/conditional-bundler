import createTypedArrayConstructor from "../internals/typed-array-constructor";
// `Uint8ClampedArray` constructor
// https://tc39.es/ecma262/#sec-typedarray-objects
createTypedArrayConstructor('Uint8', function (init) {
  return function Uint8ClampedArray(data, byteOffset, length) {
    return init(this, data, byteOffset, length);
  };
}, true);
const _cjs_default = {};
export default _cjs_default;
