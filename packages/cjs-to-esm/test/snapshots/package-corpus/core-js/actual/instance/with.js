import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../array/virtual/with";
var ArrayPrototype = Array.prototype;
const _cjs_default = function (it) {
  var own = it['with'];
  return it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype['with'] ? method : own;
};
export default _cjs_default;
