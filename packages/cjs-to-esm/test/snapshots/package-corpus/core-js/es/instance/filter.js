import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/filter";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.filter;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.filter ? method : own;
};
export default _cjs_default;
