import toPrimitive from "../internals/to-primitive";
import isSymbol from "../internals/is-symbol";
// `ToPropertyKey` abstract operation
// https://tc39.es/ecma262/#sec-topropertykey
const _cjs_default = function (argument) {
  var key = toPrimitive(argument, 'string');
  return isSymbol(key) ? key : key + '';
};
export default _cjs_default;
