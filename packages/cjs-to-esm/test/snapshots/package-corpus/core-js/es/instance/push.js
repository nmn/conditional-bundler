import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/push";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.push;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.push ? method : own;
};
export default _cjs_default;
