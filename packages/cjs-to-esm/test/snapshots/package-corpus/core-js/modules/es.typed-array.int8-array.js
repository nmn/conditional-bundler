import createTypedArrayConstructor from "../internals/typed-array-constructor";
// `Int8Array` constructor
// https://tc39.es/ecma262/#sec-typedarray-objects
createTypedArrayConstructor('Int8', function (init) {
  return function Int8Array(data, byteOffset, length) {
    return init(this, data, byteOffset, length);
  };
});
const _cjs_default = {};
export default _cjs_default;
