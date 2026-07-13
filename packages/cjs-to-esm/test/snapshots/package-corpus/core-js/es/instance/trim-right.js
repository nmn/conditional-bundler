import isPrototypeOf from "../../internals/object-is-prototype-of";
import method from "../string/virtual/trim-right";
var StringPrototype = String.prototype;
const _cjs_default = function (it) {
  var own = it.trimRight;
  return typeof it == 'string' || it === StringPrototype || isPrototypeOf(StringPrototype, it) && own === StringPrototype.trimRight ? method : own;
};
export default _cjs_default;
