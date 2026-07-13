import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/reduce";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.reduce;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.reduce ? method : own;
};
export default _cjs_default;
