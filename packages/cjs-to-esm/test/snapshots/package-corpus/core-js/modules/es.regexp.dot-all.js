import DESCRIPTORS from "../internals/descriptors";
import UNSUPPORTED_DOT_ALL from "../internals/regexp-unsupported-dot-all";
import classof from "../internals/classof-raw";
import defineBuiltInAccessor from "../internals/define-built-in-accessor";
import _cjs_import from "../internals/internal-state";
var getInternalState = _cjs_import.get;
var RegExpPrototype = RegExp.prototype;
var $TypeError = TypeError;

// `RegExp.prototype.dotAll` getter
// https://tc39.es/ecma262/#sec-get-regexp.prototype.dotall
if (DESCRIPTORS && UNSUPPORTED_DOT_ALL) {
  defineBuiltInAccessor(RegExpPrototype, 'dotAll', {
    configurable: true,
    get: function dotAll() {
      if (this === RegExpPrototype) return;
      // We can't use InternalStateModule.getterFor because
      // we don't add metadata for regexps created by a literal.
      if (classof(this) === 'RegExp') {
        return !!getInternalState(this).dotAll;
      }
      throw new $TypeError('Incompatible receiver, RegExp required');
    }
  });
}
const _cjs_default = {};
export default _cjs_default;
