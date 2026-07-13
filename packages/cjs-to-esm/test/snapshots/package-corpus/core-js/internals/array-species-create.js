import arraySpeciesConstructor from "../internals/array-species-constructor";
// `ArraySpeciesCreate` abstract operation
// https://tc39.es/ecma262/#sec-arrayspeciescreate
const _cjs_default = function (originalArray, length) {
  return new (arraySpeciesConstructor(originalArray))(length === 0 ? 0 : length);
};
export default _cjs_default;
