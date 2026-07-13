import defineBuiltIn from "../internals/define-built-in";
const _cjs_default = function (target, src, options) {
  for (var key in src) defineBuiltIn(target, key, src[key], options);
  return target;
};
export default _cjs_default;
