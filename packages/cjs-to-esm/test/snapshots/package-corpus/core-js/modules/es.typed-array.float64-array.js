import createTypedArrayConstructor from "../internals/typed-array-constructor";
// `Float64Array` constructor
// https://tc39.es/ecma262/#sec-typedarray-objects
createTypedArrayConstructor('Float64', function (init) {
  return function Float64Array(data, byteOffset, length) {
    return init(this, data, byteOffset, length);
  };
});
const _cjs_default = {};
export default _cjs_default;
