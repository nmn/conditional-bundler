import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/flat-map";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.flatMap;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.flatMap ? method : own;
};
export default _cjs_default;
