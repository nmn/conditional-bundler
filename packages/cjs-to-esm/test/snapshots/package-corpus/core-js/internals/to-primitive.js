import call from "../internals/function-call";
import isObject from "../internals/is-object";
import isSymbol from "../internals/is-symbol";
import getMethod from "../internals/get-method";
import ordinaryToPrimitive from "../internals/ordinary-to-primitive";
import wellKnownSymbol from "../internals/well-known-symbol";
var $TypeError = TypeError;
var TO_PRIMITIVE = wellKnownSymbol('toPrimitive');

// `ToPrimitive` abstract operation
// https://tc39.es/ecma262/#sec-toprimitive
const _cjs_default = function (input, pref) {
  if (!isObject(input) || isSymbol(input)) return input;
  var exoticToPrim = getMethod(input, TO_PRIMITIVE);
  var result;
  if (exoticToPrim) {
    if (pref === undefined) pref = 'default';
    result = call(exoticToPrim, input, pref);
    if (!isObject(result) || isSymbol(result)) return result;
    throw new $TypeError("Can't convert object to primitive value");
  }
  if (pref === undefined) pref = 'number';
  return ordinaryToPrimitive(input, pref);
};
export default _cjs_default;
