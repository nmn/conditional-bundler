import isCallable from "../internals/is-callable";
import tryToString from "../internals/try-to-string";
var $TypeError = TypeError;

// `Assert: IsCallable(argument) is true`
const _cjs_default = function (argument) {
  if (isCallable(argument)) return argument;
  throw new $TypeError(tryToString(argument) + ' is not a function');
};
export default _cjs_default;
