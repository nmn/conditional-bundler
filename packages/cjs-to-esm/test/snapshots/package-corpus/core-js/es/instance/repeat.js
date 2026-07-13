import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../string/virtual/repeat";
var StringPrototype = String.prototype;
const _cjs_default = function (it) {
  var own = it.repeat;
  return typeof it == 'string' || it === StringPrototype || isPrototypeOf(StringPrototype, it) && own === StringPrototype.repeat ? method : own;
};
export default _cjs_default;
