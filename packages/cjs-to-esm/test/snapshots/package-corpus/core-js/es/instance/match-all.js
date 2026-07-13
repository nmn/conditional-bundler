import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../string/virtual/match-all";
var StringPrototype = String.prototype;
const _cjs_default = function (it) {
  var own = it.matchAll;
  return typeof it == 'string' || it === StringPrototype || isPrototypeOf(StringPrototype, it) && own === StringPrototype.matchAll ? method : own;
};
export default _cjs_default;
