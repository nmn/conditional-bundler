import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/filter-out";
// TODO: Remove from `core-js@4`

var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.filterOut;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.filterOut ? method : own;
};
export default _cjs_default;
