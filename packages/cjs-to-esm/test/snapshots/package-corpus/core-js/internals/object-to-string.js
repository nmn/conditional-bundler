import TO_STRING_TAG_SUPPORT from "../internals/to-string-tag-support";
import classof from "../internals/classof";
// `Object.prototype.toString` method implementation
// https://tc39.es/ecma262/#sec-object.prototype.tostring
const _cjs_default = TO_STRING_TAG_SUPPORT ? {}.toString : function toString() {
  return '[object ' + classof(this) + ']';
};
export default _cjs_default;
