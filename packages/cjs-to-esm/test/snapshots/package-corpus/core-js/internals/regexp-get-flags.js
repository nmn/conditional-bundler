import call from "../internals/function-call";
import hasOwn from "../internals/has-own-property";
import isPrototypeOf from "../internals/object-is-prototype-of";
import { correct as _correct } from "../internals/regexp-flags-detection";
import regExpFlagsGetterImplementation from "../internals/regexp-flags";
var RegExpPrototype = RegExp.prototype;
const _cjs_default = _correct ? function (it) {
  return it.flags;
} : function (it) {
  return !_correct && isPrototypeOf(RegExpPrototype, it) && !hasOwn(it, 'flags') ? call(regExpFlagsGetterImplementation, it) : it.flags;
};
export default _cjs_default;
