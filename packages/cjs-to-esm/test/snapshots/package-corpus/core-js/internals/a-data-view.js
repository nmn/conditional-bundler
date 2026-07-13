import classof from "../internals/classof";
var $TypeError = TypeError;
const _cjs_default = function (argument) {
  if (classof(argument) === 'DataView') return argument;
  throw new $TypeError('Argument is not a DataView');
};
export default _cjs_default;
