import apply from "../internals/function-apply";
import call from "../internals/function-call";
import uncurryThis from "../internals/function-uncurry-this";
import fixRegExpWellKnownSymbolLogic from "../internals/fix-regexp-well-known-symbol-logic";
import fails from "../internals/fails";
import anObject from "../internals/an-object";
import isCallable from "../internals/is-callable";
import isObject from "../internals/is-object";
import toIntegerOrInfinity from "../internals/to-integer-or-infinity";
import toLength from "../internals/to-length";
import toString from "../internals/to-string";
import requireObjectCoercible from "../internals/require-object-coercible";
import advanceStringIndex from "../internals/advance-string-index";
import getMethod from "../internals/get-method";
import getSubstitution from "../internals/get-substitution";
import getRegExpFlags from "../internals/regexp-get-flags";
import regExpExec from "../internals/regexp-exec-abstract";
import wellKnownSymbol from "../internals/well-known-symbol";
var REPLACE = wellKnownSymbol('replace');
var max = Math.max;
var min = Math.min;
var concat = uncurryThis([].concat);
var push = uncurryThis([].push);
var stringIndexOf = uncurryThis(''.indexOf);
var stringSlice = uncurryThis(''.slice);
var maybeToString = function (it) {
  return it === undefined ? it : String(it);
};

// IE <= 11 replaces $0 with the whole match, as if it was $&
// https://stackoverflow.com/questions/6024666/getting-ie-to-replace-a-regex-with-the-literal-string-0
var REPLACE_KEEPS_$0 = function () {
  // eslint-disable-next-line regexp/prefer-escape-replacement-dollar-char -- required for testing
  return 'a'.replace(/./, '$0') === '$0';
}();

// Safari <= 13.0.3(?) substitutes nth capture where n>m with an empty string
var REGEXP_REPLACE_SUBSTITUTES_UNDEFINED_CAPTURE = function () {
  if (/./[REPLACE]) {
    return /./[REPLACE]('a', '$0') === '';
  }
  return false;
}();
var REPLACE_SUPPORTS_NAMED_GROUPS = !fails(function () {
  var re = /./;
  re.exec = function () {
    var result = [];
    result.groups = {
      a: '7'
    };
    return result;
  };
  // eslint-disable-next-line regexp/no-useless-dollar-replacements -- false positive
  return ''.replace(re, '$<a>') !== '7';
});

// @@replace logic
fixRegExpWellKnownSymbolLogic('replace', function (_, nativeReplace, maybeCallNative) {
  var UNSAFE_SUBSTITUTE = REGEXP_REPLACE_SUBSTITUTES_UNDEFINED_CAPTURE ? '$' : '$0';
  return [
  // `String.prototype.replace` method
  // https://tc39.es/ecma262/#sec-string.prototype.replace
  function replace(searchValue, replaceValue) {
    var O = requireObjectCoercible(this);
    var replacer = isObject(searchValue) ? getMethod(searchValue, REPLACE) : undefined;
    return replacer ? call(replacer, searchValue, O, replaceValue) : call(nativeReplace, toString(O), searchValue, replaceValue);
  },
  // `RegExp.prototype[@@replace]` method
  // https://tc39.es/ecma262/#sec-regexp.prototype-@@replace
  function (string, replaceValue) {
    var rx = anObject(this);
    var S = toString(string);
    var functionalReplace = isCallable(replaceValue);
    if (!functionalReplace) replaceValue = toString(replaceValue);
    var flags = toString(getRegExpFlags(rx));
    if (typeof replaceValue == 'string' && !~stringIndexOf(replaceValue, UNSAFE_SUBSTITUTE) && !~stringIndexOf(replaceValue, '$<') && !~stringIndexOf(flags, 'y')) {
      var res = maybeCallNative(nativeReplace, rx, S, replaceValue);
      if (res.done) return res.value;
    }
    var global = !!~stringIndexOf(flags, 'g');
    var fullUnicode;
    if (global) {
      fullUnicode = !!~stringIndexOf(flags, 'u') || !!~stringIndexOf(flags, 'v');
      rx.lastIndex = 0;
    }
    var results = [];
    var result;
    while (true) {
      result = regExpExec(rx, S);
      if (result === null) break;
      push(results, result);
      if (!global) break;
      var matchStr = toString(result[0]);
      if (matchStr === '') rx.lastIndex = advanceStringIndex(S, toLength(rx.lastIndex), fullUnicode);
    }
    var accumulatedResult = '';
    var nextSourcePosition = 0;
    for (var i = 0; i < results.length; i++) {
      result = results[i];
      var matched = toString(result[0]);
      var position = max(min(toIntegerOrInfinity(result.index), S.length), 0);
      var captures = [];
      var replacement;
      // NOTE: This is equivalent to
      //   captures = result.slice(1).map(maybeToString)
      // but for some reason `nativeSlice.call(result, 1, result.length)` (called in
      // the slice polyfill when slicing native arrays) "doesn't work" in safari 9 and
      // causes a crash (https://pastebin.com/N21QzeQA) when trying to debug it.
      for (var j = 1; j < result.length; j++) push(captures, maybeToString(result[j]));
      var namedCaptures = result.groups;
      if (functionalReplace) {
        var replacerArgs = concat([matched], captures, position, S);
        if (namedCaptures !== undefined) push(replacerArgs, namedCaptures);
        replacement = toString(apply(replaceValue, undefined, replacerArgs));
      } else {
        replacement = getSubstitution(matched, S, position, captures, namedCaptures, replaceValue);
      }
      if (position >= nextSourcePosition) {
        accumulatedResult += stringSlice(S, nextSourcePosition, position) + replacement;
        nextSourcePosition = position + matched.length;
      }
    }
    return accumulatedResult + stringSlice(S, nextSourcePosition);
  }];
}, !REPLACE_SUPPORTS_NAMED_GROUPS || !REPLACE_KEEPS_$0 || REGEXP_REPLACE_SUBSTITUTES_UNDEFINED_CAPTURE);
const _cjs_default = {};
export default _cjs_default;
