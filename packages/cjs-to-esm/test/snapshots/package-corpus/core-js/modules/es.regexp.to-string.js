import _cjs_import from "../internals/function-name";
import defineBuiltIn from "../internals/define-built-in";
import anObject from "../internals/an-object";
import $toString from "../internals/to-string";
import fails from "../internals/fails";
import getRegExpFlags from "../internals/regexp-get-flags";
var PROPER_FUNCTION_NAME = _cjs_import.PROPER;
var TO_STRING = 'toString';
var RegExpPrototype = RegExp.prototype;
var nativeToString = RegExpPrototype[TO_STRING];
var NOT_GENERIC = fails(function () {
  return nativeToString.call({
    source: 'a',
    flags: 'b'
  }) !== '/a/b';
});
// FF44- RegExp#toString has a wrong name
var INCORRECT_NAME = PROPER_FUNCTION_NAME && nativeToString.name !== TO_STRING;

// `RegExp.prototype.toString` method
// https://tc39.es/ecma262/#sec-regexp.prototype.tostring
if (NOT_GENERIC || INCORRECT_NAME) {
  defineBuiltIn(RegExpPrototype, TO_STRING, function toString() {
    var R = anObject(this);
    var pattern = $toString(R.source);
    var flags = $toString(getRegExpFlags(R));
    return '/' + pattern + '/' + flags;
  }, {
    unsafe: true
  });
}
const _cjs_default = {};
export default _cjs_default;
