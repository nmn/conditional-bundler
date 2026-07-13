import classof from "../internals/classof";
var $TypeError = TypeError;

// Perform ? RequireInternalSlot(argument, [[TypedArrayName]])
// If argument.[[TypedArrayName]] is not "Uint8Array", throw a TypeError exception
const _cjs_default = function (argument) {
  if (classof(argument) === 'Uint8Array') return argument;
  throw new $TypeError('Argument is not an Uint8Array');
};
export default _cjs_default;
