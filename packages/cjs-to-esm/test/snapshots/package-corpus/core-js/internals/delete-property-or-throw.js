import tryToString from "../internals/try-to-string";
var $TypeError = TypeError;
const _cjs_default = function (O, P) {
  if (!delete O[P]) throw new $TypeError('Cannot delete property ' + tryToString(P) + ' of ' + tryToString(O));
};
export default _cjs_default;
