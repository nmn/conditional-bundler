import classof from "../internals/classof-raw";
// `IsArray` abstract operation
// https://tc39.es/ecma262/#sec-isarray
// eslint-disable-next-line es/no-array-isarray -- safe
const _cjs_default = Array.isArray || function isArray(argument) {
  return classof(argument) === 'Array';
};
export default _cjs_default;
