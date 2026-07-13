import isPrototypeOf from "../../internals/object-is-prototype-of";
import arrayMethod from "../array/virtual/at";
import stringMethod from "../string/virtual/at";
var ArrayPrototype = Array.prototype;
var StringPrototype = String.prototype;
const _cjs_default = function (it) {
  var own = it.at;
  if (it === ArrayPrototype || isPrototypeOf(ArrayPrototype, it) && own === ArrayPrototype.at) return arrayMethod;
  if (typeof it == 'string' || it === StringPrototype || isPrototypeOf(StringPrototype, it) && own === StringPrototype.at) {
    return stringMethod;
  }
  return own;
};
export default _cjs_default;
