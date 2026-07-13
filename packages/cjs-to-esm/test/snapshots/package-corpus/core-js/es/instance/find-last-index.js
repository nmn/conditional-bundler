import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/find-last-index";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.findLastIndex;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.findLastIndex ? method : own;
};
export default _cjs_default;
