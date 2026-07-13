import classof from "../internals/classof";
var $String = String;
const _cjs_default = function (argument) {
  if (classof(argument) === 'Symbol') throw new TypeError('Cannot convert a Symbol value to a string');
  return $String(argument);
};
export default _cjs_default;
