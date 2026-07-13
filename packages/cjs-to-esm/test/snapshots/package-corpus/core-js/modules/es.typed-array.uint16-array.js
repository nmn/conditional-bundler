import createTypedArrayConstructor from "../internals/typed-array-constructor";
// `Uint16Array` constructor
// https://tc39.es/ecma262/#sec-typedarray-objects
createTypedArrayConstructor('Uint16', function (init) {
  return function Uint16Array(data, byteOffset, length) {
    return init(this, data, byteOffset, length);
  };
});
const _cjs_default = {};
export default _cjs_default;
