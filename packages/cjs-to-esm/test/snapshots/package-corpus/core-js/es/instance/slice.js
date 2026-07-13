import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/slice";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.slice;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.slice ? method : own;
};
export default _cjs_default;
