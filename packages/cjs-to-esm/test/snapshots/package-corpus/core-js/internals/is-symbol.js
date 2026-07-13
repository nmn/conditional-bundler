import getBuiltIn from "../internals/get-built-in";
import isCallable from "../internals/is-callable";
import isPrototypeOf from "../internals/object-is-prototype-of";
import USE_SYMBOL_AS_UID from "../internals/use-symbol-as-uid";
var $Object = Object;
const _cjs_default = USE_SYMBOL_AS_UID ? function (it) {
  return typeof it == 'symbol';
} : function (it) {
  var $Symbol = getBuiltIn('Symbol');
  return isCallable($Symbol) && isPrototypeOf($Symbol.prototype, $Object(it));
};
export default _cjs_default;
