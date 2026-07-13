import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/values";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.values;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.values ? method : own;
};
export default _cjs_default;
