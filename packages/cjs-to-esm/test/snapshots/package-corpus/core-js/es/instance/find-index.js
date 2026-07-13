import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/find-index";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.findIndex;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.findIndex ? method : own;
};
export default _cjs_default;
