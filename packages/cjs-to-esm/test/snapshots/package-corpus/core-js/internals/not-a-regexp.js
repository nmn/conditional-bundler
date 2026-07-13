import isRegExp from "../internals/is-regexp";
var $TypeError = TypeError;
const _cjs_default = function (it) {
  if (isRegExp(it)) {
    throw new $TypeError("The method doesn't accept regular expressions");
  }
  return it;
};
export default _cjs_default;
