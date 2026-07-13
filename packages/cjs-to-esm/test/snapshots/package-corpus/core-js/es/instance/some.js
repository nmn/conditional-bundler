import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/some";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.some;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.some ? method : own;
};
export default _cjs_default;
