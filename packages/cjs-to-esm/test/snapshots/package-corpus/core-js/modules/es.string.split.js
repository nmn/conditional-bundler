import call from "../internals/function-call";
import uncurryThis from "../internals/function-uncurry-this";
import fixRegExpWellKnownSymbolLogic from "../internals/fix-regexp-well-known-symbol-logic";
import anObject from "../internals/an-object";
import isObject from "../internals/is-object";
import requireObjectCoercible from "../internals/require-object-coercible";
import speciesConstructor from "../internals/species-constructor";
import advanceStringIndex from "../internals/advance-string-index";
import toLength from "../internals/to-length";
import toString from "../internals/to-string";
import getMethod from "../internals/get-method";
import getRegExpFlags from "../internals/regexp-get-flags";
import regExpExec from "../internals/regexp-exec-abstract";
import stickyHelpers from "../internals/regexp-sticky-helpers";
import fails from "../internals/fails";
var UNSUPPORTED_Y = stickyHelpers.UNSUPPORTED_Y;
var MAX_UINT32 = 0xFFFFFFFF;
var min = Math.min;
var push = uncurryThis([].push);
var stringSlice = uncurryThis(''.slice);
var stringIndexOf = uncurryThis(''.indexOf);

// Chrome 51 has a buggy "split" implementation when RegExp#exec !== nativeExec
// Weex JS has frozen built-in prototypes, so use try / catch wrapper
var SPLIT_WORKS_WITH_OVERWRITTEN_EXEC = !fails(function () {
  // eslint-disable-next-line regexp/no-empty-group -- required for testing
  var re = /(?:)/;
  var originalExec = re.exec;
  re.exec = function () {
    return originalExec.apply(this, arguments);
  };
  var result = 'ab'.split(re);
  return result.length !== 2 || result[0] !== 'a' || result[1] !== 'b';
});
var BUGGY = 'abbc'.split(/(b)*/)[1] === 'c' ||
// eslint-disable-next-line regexp/no-empty-group -- required for testing
'test'.split(/(?:)/, -1).length !== 4 || 'ab'.split(/(?:ab)*/).length !== 2 || '.'.split(/(.?)(.?)/).length !== 4 ||
// eslint-disable-next-line regexp/no-empty-capturing-group, regexp/no-empty-group -- required for testing
'.'.split(/()()/).length > 1 || ''.split(/.?/).length;

// @@split logic
fixRegExpWellKnownSymbolLogic('split', function (SPLIT, nativeSplit, maybeCallNative) {
  var internalSplit = '0'.split(undefined, 0).length ? function (separator, limit) {
    return separator === undefined && limit === 0 ? [] : call(nativeSplit, this, separator, limit);
  } : nativeSplit;
  return [
  // `String.prototype.split` method
  // https://tc39.es/ecma262/#sec-string.prototype.split
  function split(separator, limit) {
    var O = requireObjectCoercible(this);
    var splitter = isObject(separator) ? getMethod(separator, SPLIT) : undefined;
    return splitter ? call(splitter, separator, O, limit) : call(internalSplit, toString(O), separator, limit);
  },
  // `RegExp.prototype[@@split]` method
  // https://tc39.es/ecma262/#sec-regexp.prototype-@@split
  //
  // NOTE: This cannot be properly polyfilled in engines that don't support
  // the 'y' flag.
  function (string, limit) {
    var rx = anObject(this);
    var S = toString(string);
    if (!BUGGY) {
      var res = maybeCallNative(internalSplit, rx, S, limit, internalSplit !== nativeSplit);
      if (res.done) return res.value;
    }
    var C = speciesConstructor(rx, RegExp);
    var flags = toString(getRegExpFlags(rx));
    var unicodeMatching = !!~stringIndexOf(flags, 'u') || !!~stringIndexOf(flags, 'v');
    if (UNSUPPORTED_Y) {
      if (!~stringIndexOf(flags, 'g')) flags += 'g';
    } else if (!~stringIndexOf(flags, 'y')) flags += 'y';
    // ^(? + rx + ) is needed, in combination with some S slicing, to
    // simulate the 'y' flag.
    var splitter = new C(UNSUPPORTED_Y ? '^(?:' + rx.source + ')' : rx, flags);
    var lim = limit === undefined ? MAX_UINT32 : limit >>> 0;
    if (lim === 0) return [];
    if (S.length === 0) return regExpExec(splitter, S) === null ? [S] : [];
    var p = 0;
    var q = 0;
    var A = [];
    while (q < S.length) {
      splitter.lastIndex = UNSUPPORTED_Y ? 0 : q;
      var z = regExpExec(splitter, UNSUPPORTED_Y ? stringSlice(S, q) : S);
      var e;
      if (z === null || (e = min(toLength(splitter.lastIndex + (UNSUPPORTED_Y ? q : 0)), S.length)) === p) {
        q = advanceStringIndex(S, q, unicodeMatching);
      } else {
        push(A, stringSlice(S, p, q));
        if (A.length === lim) return A;
        for (var i = 1; i <= z.length - 1; i++) {
          push(A, z[i]);
          if (A.length === lim) return A;
        }
        q = p = e;
      }
    }
    push(A, stringSlice(S, p));
    return A;
  }];
}, BUGGY || !SPLIT_WORKS_WITH_OVERWRITTEN_EXEC, UNSUPPORTED_Y);
const _cjs_default = {};
export default _cjs_default;
