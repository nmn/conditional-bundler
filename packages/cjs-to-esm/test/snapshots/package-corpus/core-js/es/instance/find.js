import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/find";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.find;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.find ? method : own;
};
export default _cjs_default;
