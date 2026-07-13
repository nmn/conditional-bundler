import classofRaw from "../internals/classof-raw";
import uncurryThis from "../internals/function-uncurry-this";
const _cjs_default = function (fn) {
  // Nashorn bug:
  //   https://github.com/zloirock/core-js/issues/1128
  //   https://github.com/zloirock/core-js/issues/1130
  if (classofRaw(fn) === 'Function') return uncurryThis(fn);
};
export default _cjs_default;
