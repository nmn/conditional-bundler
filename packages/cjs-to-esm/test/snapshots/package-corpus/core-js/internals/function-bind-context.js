import uncurryThis from "../internals/function-uncurry-this-clause";
import aCallable from "../internals/a-callable";
import NATIVE_BIND from "../internals/function-bind-native";
var bind = uncurryThis(uncurryThis.bind);

// optional / simple context binding
const _cjs_default = function (fn, that) {
  aCallable(fn);
  return that === undefined ? fn : NATIVE_BIND ? bind(fn, that) : function /* ...args */
  () {
    return fn.apply(that, arguments);
  };
};
export default _cjs_default;
