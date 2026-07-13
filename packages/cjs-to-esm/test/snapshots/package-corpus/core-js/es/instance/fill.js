import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/fill";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.fill;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.fill ? method : own;
};
export default _cjs_default;
