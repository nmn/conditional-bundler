import call from "../internals/function-call";
import fixRegExpWellKnownSymbolLogic from "../internals/fix-regexp-well-known-symbol-logic";
import anObject from "../internals/an-object";
import isObject from "../internals/is-object";
import requireObjectCoercible from "../internals/require-object-coercible";
import sameValue from "../internals/same-value";
import toString from "../internals/to-string";
import getMethod from "../internals/get-method";
import regExpExec from "../internals/regexp-exec-abstract";
// @@search logic
fixRegExpWellKnownSymbolLogic('search', function (SEARCH, nativeSearch, maybeCallNative) {
  return [
  // `String.prototype.search` method
  // https://tc39.es/ecma262/#sec-string.prototype.search
  function search(regexp) {
    var O = requireObjectCoercible(this);
    var searcher = isObject(regexp) ? getMethod(regexp, SEARCH) : undefined;
    return searcher ? call(searcher, regexp, O) : new RegExp(regexp)[SEARCH](toString(O));
  },
  // `RegExp.prototype[@@search]` method
  // https://tc39.es/ecma262/#sec-regexp.prototype-@@search
  function (string) {
    var rx = anObject(this);
    var S = toString(string);
    var res = maybeCallNative(nativeSearch, rx, S);
    if (res.done) return res.value;
    var previousLastIndex = rx.lastIndex;
    if (!sameValue(previousLastIndex, 0)) rx.lastIndex = 0;
    var result = regExpExec(rx, S);
    if (!sameValue(rx.lastIndex, previousLastIndex)) rx.lastIndex = previousLastIndex;
    return result === null ? -1 : result.index;
  }];
});
const _cjs_default = {};
export default _cjs_default;
