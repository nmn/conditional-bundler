import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/reverse";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.reverse;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.reverse ? method : own;
};
export default _cjs_default;
