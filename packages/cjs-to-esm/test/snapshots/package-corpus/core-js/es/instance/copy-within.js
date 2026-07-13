import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/copy-within";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.copyWithin;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.copyWithin ? method : own;
};
export default _cjs_default;
