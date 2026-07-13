import uncurryThis from "../internals/function-uncurry-this";
var id = 0;
var postfix = Math.random();
var toString = uncurryThis(1.1.toString);
const _cjs_default = function (key) {
  return 'Symbol(' + (key === undefined ? '' : key) + ')_' + toString(++id + postfix, 36);
};
export default _cjs_default;
