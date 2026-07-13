import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/group-by";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.groupBy;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.groupBy ? method : own;
};
export default _cjs_default;
