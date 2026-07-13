import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/map";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.map;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.map ? method : own;
};
export default _cjs_default;
