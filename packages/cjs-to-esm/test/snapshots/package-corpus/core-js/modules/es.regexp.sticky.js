import DESCRIPTORS from "../internals/descriptors";
import { MISSED_STICKY as _MISSED_STICKY } from "../internals/regexp-sticky-helpers";
import classof from "../internals/classof-raw";
import defineBuiltInAccessor from "../internals/define-built-in-accessor";
import { get as _get } from "../internals/internal-state";
var MISSED_STICKY = _MISSED_STICKY;
var getInternalState = _get;
var RegExpPrototype = RegExp.prototype;
var $TypeError = TypeError;

// `RegExp.prototype.sticky` getter
// https://tc39.es/ecma262/#sec-get-regexp.prototype.sticky
if (DESCRIPTORS && MISSED_STICKY) {
  defineBuiltInAccessor(RegExpPrototype, 'sticky', {
    configurable: true,
    get: function sticky() {
      if (this === RegExpPrototype) return;
      // We can't use InternalStateModule.getterFor because
      // we don't add metadata for regexps created by a literal.
      if (classof(this) === 'RegExp') {
        return !!getInternalState(this).sticky;
      }
      throw new $TypeError('Incompatible receiver, RegExp required');
    }
  });
}
const _cjs_default = {};
export default _cjs_default;
