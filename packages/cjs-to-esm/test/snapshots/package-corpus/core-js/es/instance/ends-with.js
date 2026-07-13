import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../string/virtual/ends-with";
var StringPrototype = String.prototype;
const _cjs_default = function (it) {
  var own = it.endsWith;
  return typeof it == 'string' || it === StringPrototype || isPrototypeOf(StringPrototype, it) && own === StringPrototype.endsWith ? method : own;
};
export default _cjs_default;
