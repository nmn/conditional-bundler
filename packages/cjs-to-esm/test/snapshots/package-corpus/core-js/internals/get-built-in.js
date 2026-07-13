import globalThis from "../internals/global-this";
import isCallable from "../internals/is-callable";
var aFunction = function (argument) {
  return isCallable(argument) ? argument : undefined;
};
const _cjs_default = function (namespace, method) {
  return arguments.length < 2 ? aFunction(globalThis[namespace]) : globalThis[namespace] && globalThis[namespace][method];
};
export default _cjs_default;
