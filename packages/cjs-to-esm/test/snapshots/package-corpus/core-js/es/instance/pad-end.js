import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../string/virtual/pad-end";
var StringPrototype = String.prototype;
const _cjs_default = function (it) {
  var own = it.padEnd;
  return typeof it == 'string' || it === StringPrototype || isPrototypeOf(StringPrototype, it) && own === StringPrototype.padEnd ? method : own;
};
export default _cjs_default;
