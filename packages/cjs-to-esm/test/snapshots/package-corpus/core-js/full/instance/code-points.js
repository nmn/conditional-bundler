import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../string/virtual/code-points";
var StringPrototype = String.prototype;
const _cjs_default = function (it) {
  var own = it.codePoints;
  return typeof it == 'string' || it === StringPrototype || isPrototypeOf(StringPrototype, it) && own === StringPrototype.codePoints ? method : own;
};
export default _cjs_default;
