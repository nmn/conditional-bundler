import toLength from "../internals/to-length";
// `LengthOfArrayLike` abstract operation
// https://tc39.es/ecma262/#sec-lengthofarraylike
const _cjs_default = function (obj) {
  return toLength(obj.length);
};
export default _cjs_default;
