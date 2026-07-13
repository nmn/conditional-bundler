import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/to-sorted";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.toSorted;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.toSorted ? method : own;
};
export default _cjs_default;
