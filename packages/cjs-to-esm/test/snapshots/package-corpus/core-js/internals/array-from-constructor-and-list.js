import lengthOfArrayLike from "../internals/length-of-array-like";
const _cjs_default = function (Constructor, list, $length) {
  var index = 0;
  var length = arguments.length > 2 ? $length : lengthOfArrayLike(list);
  var result = new Constructor(length);
  while (length > index) result[index] = list[index++];
  return result;
};
export default _cjs_default;
