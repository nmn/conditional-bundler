import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/keys";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.keys;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.keys ? method : own;
};
export default _cjs_default;
