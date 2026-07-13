import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/to-spliced";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.toSpliced;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.toSpliced ? method : own;
};
export default _cjs_default;
