import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../string/virtual/is-well-formed";
var StringPrototype = String.prototype;
const _cjs_default = function (it) {
  var own = it.isWellFormed;
  return typeof it == 'string' || it === StringPrototype || isPrototypeOf(StringPrototype, it) && own === StringPrototype.isWellFormed ? method : own;
};
export default _cjs_default;
