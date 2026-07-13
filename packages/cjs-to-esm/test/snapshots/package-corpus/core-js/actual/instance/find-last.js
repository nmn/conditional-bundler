import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/find-last";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.findLast;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.findLast ? method : own;
};
export default _cjs_default;
