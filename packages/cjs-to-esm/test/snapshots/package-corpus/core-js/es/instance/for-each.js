import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/for-each";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.forEach;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.forEach ? method : own;
};
export default _cjs_default;
