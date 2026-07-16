import DESCRIPTORS from "../internals/descriptors";
import _cjs_import from "../internals/regexp-sticky-helpers";
import classof from "../internals/classof-raw";
import defineBuiltInAccessor from "../internals/define-built-in-accessor";
import _cjs_import2 from "../internals/internal-state";
var MISSED_STICKY = _cjs_import.MISSED_STICKY;
var getInternalState = _cjs_import2.get;
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
