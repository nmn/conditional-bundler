import isObject from "../internals/is-object";
var $String = String;
var $TypeError = TypeError;

// `Assert: Type(argument) is Object`
const _cjs_default = function (argument) {
  if (isObject(argument)) return argument;
  throw new $TypeError($String(argument) + ' is not an object');
};
export default _cjs_default;
