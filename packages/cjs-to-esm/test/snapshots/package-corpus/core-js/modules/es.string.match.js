import call from "../internals/function-call";
import uncurryThis from "../internals/function-uncurry-this";
import fixRegExpWellKnownSymbolLogic from "../internals/fix-regexp-well-known-symbol-logic";
import anObject from "../internals/an-object";
import isObject from "../internals/is-object";
import toLength from "../internals/to-length";
import toString from "../internals/to-string";
import requireObjectCoercible from "../internals/require-object-coercible";
import getMethod from "../internals/get-method";
import advanceStringIndex from "../internals/advance-string-index";
import getRegExpFlags from "../internals/regexp-get-flags";
import regExpExec from "../internals/regexp-exec-abstract";
var stringIndexOf = uncurryThis(''.indexOf);

// @@match logic
fixRegExpWellKnownSymbolLogic('match', function (MATCH, nativeMatch, maybeCallNative) {
  return [
  // `String.prototype.match` method
  // https://tc39.es/ecma262/#sec-string.prototype.match
  function match(regexp) {
    var O = requireObjectCoercible(this);
    var matcher = isObject(regexp) ? getMethod(regexp, MATCH) : undefined;
    return matcher ? call(matcher, regexp, O) : new RegExp(regexp)[MATCH](toString(O));
  },
  // `RegExp.prototype[@@match]` method
  // https://tc39.es/ecma262/#sec-regexp.prototype-@@match
  function (string) {
    var rx = anObject(this);
    var S = toString(string);
    var res = maybeCallNative(nativeMatch, rx, S);
    if (res.done) return res.value;
    var flags = toString(getRegExpFlags(rx));
    if (!~stringIndexOf(flags, 'g')) return regExpExec(rx, S);
    var fullUnicode = !!~stringIndexOf(flags, 'u') || !!~stringIndexOf(flags, 'v');
    rx.lastIndex = 0;
    var A = [];
    var n = 0;
    var result;
    while ((result = regExpExec(rx, S)) !== null) {
      var matchStr = toString(result[0]);
      A[n] = matchStr;
      if (matchStr === '') rx.lastIndex = advanceStringIndex(S, toLength(rx.lastIndex), fullUnicode);
      n++;
    }
    return n === 0 ? null : A;
  }];
});
const _cjs_default = {};
export default _cjs_default;
