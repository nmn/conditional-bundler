import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/concat";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.concat;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.concat ? method : own;
};
export default _cjs_default;
