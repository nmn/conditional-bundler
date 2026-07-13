import isPossiblePrototype from "../internals/is-possible-prototype";
var $String = String;
var $TypeError = TypeError;
const _cjs_default = function (argument) {
  if (isPossiblePrototype(argument)) return argument;
  throw new $TypeError("Can't set " + $String(argument) + ' as a prototype');
};
export default _cjs_default;
