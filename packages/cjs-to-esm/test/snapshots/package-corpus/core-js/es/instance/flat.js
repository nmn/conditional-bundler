import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/flat";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.flat;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.flat ? method : own;
};
export default _cjs_default;
