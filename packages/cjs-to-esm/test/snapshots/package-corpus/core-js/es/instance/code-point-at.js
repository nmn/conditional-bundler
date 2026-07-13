import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../string/virtual/code-point-at";
var StringPrototype = String.prototype;
const _cjs_default = function (it) {
  var own = it.codePointAt;
  return typeof it == 'string' || it === StringPrototype || isPrototypeOf(StringPrototype, it) && own === StringPrototype.codePointAt ? method : own;
};
export default _cjs_default;
