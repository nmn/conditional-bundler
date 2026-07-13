import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../string/virtual/trim-left";
var StringPrototype = String.prototype;
const _cjs_default = function (it) {
  var own = it.trimLeft;
  return typeof it == 'string' || it === StringPrototype || isPrototypeOf(StringPrototype, it) && own === StringPrototype.trimLeft ? method : own;
};
export default _cjs_default;
