import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/unique-by";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.uniqueBy;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.uniqueBy ? method : own;
};
export default _cjs_default;
