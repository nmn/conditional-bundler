import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/every";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.every;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.every ? method : own;
};
export default _cjs_default;
