import isConstructor from "../internals/is-constructor";
import tryToString from "../internals/try-to-string";
var $TypeError = TypeError;

// `Assert: IsConstructor(argument) is true`
const _cjs_default = function (argument) {
  if (isConstructor(argument)) return argument;
  throw new $TypeError(tryToString(argument) + ' is not a constructor');
};
export default _cjs_default;
