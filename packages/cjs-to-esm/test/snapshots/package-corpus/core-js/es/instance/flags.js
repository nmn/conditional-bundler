import isPrototypeOf from "../../internals/object-is-prototype-of";
import flags from "../regexp/flags";
var RegExpPrototype = RegExp.prototype;
const _cjs_default = function (it) {
  return it === RegExpPrototype || isPrototypeOf(RegExpPrototype, it) ? flags(it) : it.flags;
};
export default _cjs_default;
