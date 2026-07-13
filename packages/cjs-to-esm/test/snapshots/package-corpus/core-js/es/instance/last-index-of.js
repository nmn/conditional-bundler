import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/last-index-of";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.lastIndexOf;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.lastIndexOf ? method : own;
};
export default _cjs_default;
