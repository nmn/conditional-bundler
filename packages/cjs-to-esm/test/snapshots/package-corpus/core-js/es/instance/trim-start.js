import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../string/virtual/trim-start";
var StringPrototype = String.prototype;
const _cjs_default = function (it) {
  var own = it.trimStart;
  return typeof it == 'string' || it === StringPrototype || isPrototypeOf(StringPrototype, it) && own === StringPrototype.trimStart ? method : own;
};
export default _cjs_default;
