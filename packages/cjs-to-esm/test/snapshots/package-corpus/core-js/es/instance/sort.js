import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/sort";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.sort;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.sort ? method : own;
};
export default _cjs_default;
