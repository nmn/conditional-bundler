import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/entries";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it.entries;
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.entries ? method : own;
};
export default _cjs_default;
