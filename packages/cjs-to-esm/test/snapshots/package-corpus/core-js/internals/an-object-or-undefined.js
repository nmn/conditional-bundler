import isObject from "../internals/is-object";
var $String = String;
var $TypeError = TypeError;
const _cjs_default = function (argument) {
  if (argument === undefined || isObject(argument)) return argument;
  throw new $TypeError($String(argument) + ' is not an object or undefined');
};
export default _cjs_default;
