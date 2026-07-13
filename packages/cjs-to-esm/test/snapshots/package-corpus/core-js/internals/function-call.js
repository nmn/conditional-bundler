import NATIVE_BIND from "../internals/function-bind-native";
var call = Function.prototype.call;
// eslint-disable-next-line es/no-function-prototype-bind -- safe
const _cjs_default = NATIVE_BIND ? call.bind(call) : function () {
  return call.apply(call, arguments);
};
export default _cjs_default;
