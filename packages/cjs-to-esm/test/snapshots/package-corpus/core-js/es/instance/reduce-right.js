import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/reduce-right";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.reduceRight;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.reduceRight ? method : own;
};
export default _cjs_default;
