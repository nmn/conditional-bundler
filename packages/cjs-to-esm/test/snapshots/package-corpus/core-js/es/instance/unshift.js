import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/unshift";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.unshift;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.unshift ? method : own;
};
export default _cjs_default;
