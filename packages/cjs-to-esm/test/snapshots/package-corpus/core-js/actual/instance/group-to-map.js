import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/group-to-map";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.groupToMap;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.groupToMap ? method : own;
};
export default _cjs_default;
