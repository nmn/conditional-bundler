import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../string/virtual/starts-with";
var StringPrototype = String.prototype;
const _cjs_default = function (it) {
  var own = it.startsWith;
  return typeof it == 'string' || it === StringPrototype || isPrototypeOf(StringPrototype, it) && own === StringPrototype.startsWith ? method : own;
};
export default _cjs_default;
