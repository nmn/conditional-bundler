import uncurryThis from "../internals/function-uncurry-this";
var toString = uncurryThis({}.toString);
var stringSlice = uncurryThis(''.slice);
const _cjs_default = function (it) {
  return stringSlice(toString(it), 8, -1);
};
export default _cjs_default;
