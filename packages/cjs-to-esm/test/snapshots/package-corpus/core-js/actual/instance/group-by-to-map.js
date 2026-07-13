import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/group-by-to-map";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.groupByToMap;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.groupByToMap ? method : own;
};
export default _cjs_default;
