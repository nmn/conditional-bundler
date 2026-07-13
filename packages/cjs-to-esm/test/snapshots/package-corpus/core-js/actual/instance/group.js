import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/group";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.group;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.group ? method : own;
};
export default _cjs_default;
