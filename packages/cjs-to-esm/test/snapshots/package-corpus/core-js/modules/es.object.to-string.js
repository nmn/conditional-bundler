import TO_STRING_TAG_SUPPORT from "../internals/to-string-tag-support";
import defineBuiltIn from "../internals/define-built-in";
import toString from "../internals/object-to-string";
// `Object.prototype.toString` method
// https://tc39.es/ecma262/#sec-object.prototype.tostring
if (!TO_STRING_TAG_SUPPORT) {
  defineBuiltIn(Object.prototype, 'toString', toString, {
    unsafe: true
  });
}
const _cjs_default = {};
export default _cjs_default;
