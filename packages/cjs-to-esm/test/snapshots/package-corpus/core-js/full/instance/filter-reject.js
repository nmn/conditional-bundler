import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/filter-reject";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.filterReject;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.filterReject ? method : own;
};
export default _cjs_default;
