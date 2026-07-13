import isPrototypeOf from "../../internals/object-is-prototype-of";
import arrayMethod from "../array/virtual/includes";
import stringMethod from "../string/virtual/includes";
var ArrayPrototype = Array.prototype;
var StringPrototype = String.prototype;
const _cjs_default = function (it) {
  var own = it.includes;
  if (it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.includes) return arrayMethod;
  if (typeof it == 'string' || it === StringPrototype || isPrototypeOf(StringPrototype, it) && own === StringPrototype.includes) {
    return stringMethod;
  }
  return own;
};
export default _cjs_default;
