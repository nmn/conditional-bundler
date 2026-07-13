import DESCRIPTORS from "../internals/descriptors";
import defineBuiltInAccessor from "../internals/define-built-in-accessor";
import { correct as _correct } from "../internals/regexp-flags-detection";
import regExpFlagsGetterImplementation from "../internals/regexp-flags";
// `RegExp.prototype.flags` getter
// https://tc39.es/ecma262/#sec-get-regexp.prototype.flags
if (DESCRIPTORS && !_correct) {
  defineBuiltInAccessor(RegExp.prototype, 'flags', {
    configurable: true,
    get: regExpFlagsGetterImplementation
  });
  _correct = true;
}
const _cjs_default = {};
export default _cjs_default;
