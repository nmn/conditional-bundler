import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../string/virtual/pad-start";
var StringPrototype = String.prototype;
const _cjs_default = function (it) {
  var own = it.padStart;
  return typeof it == 'string' || it === StringPrototype || isPrototypeOf(StringPrototype, it) && own === StringPrototype.padStart ? method : own;
};
export default _cjs_default;
