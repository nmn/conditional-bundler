import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/splice";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.splice;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.splice ? method : own;
};
export default _cjs_default;
