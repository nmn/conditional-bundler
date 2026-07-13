import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/index-of";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.indexOf;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.indexOf ? method : own;
};
export default _cjs_default;
