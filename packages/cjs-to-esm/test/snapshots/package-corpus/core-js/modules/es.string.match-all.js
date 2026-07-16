import $ from "../internals/export";
import call from "../internals/function-call";
import uncurryThis from "../internals/function-uncurry-this-clause";
import createIteratorConstructor from "../internals/iterator-create-constructor";
import createIterResultObject from "../internals/create-iter-result-object";
import requireObjectCoercible from "../internals/require-object-coercible";
import toLength from "../internals/to-length";
import toString from "../internals/to-string";
import anObject from "../internals/an-object";
import isObject from "../internals/is-object";
import classof from "../internals/classof-raw";
import isRegExp from "../internals/is-regexp";
import getRegExpFlags from "../internals/regexp-get-flags";
import getMethod from "../internals/get-method";
import defineBuiltIn from "../internals/define-built-in";
import fails from "../internals/fails";
import wellKnownSymbol from "../internals/well-known-symbol";
import speciesConstructor from "../internals/species-constructor";
import advanceStringIndex from "../internals/advance-string-index";
import regExpExec from "../internals/regexp-exec-abstract";
import InternalStateModule from "../internals/internal-state";
import IS_PURE from "../internals/is-pure";
/* eslint-disable es/no-string-prototype-matchall -- safe */

var MATCH_ALL = wellKnownSymbol('matchAll');
var REGEXP_STRING = 'RegExp String';
var REGEXP_STRING_ITERATOR = REGEXP_STRING + ' Iterator';
var setInternalState = InternalStateModule.set;
var getInternalState = InternalStateModule.getterFor(REGEXP_STRING_ITERATOR);
var RegExpPrototype = RegExp.prototype;
var $TypeError = TypeError;
var stringIndexOf = uncurryThis(''.indexOf);
var nativeMatchAll = uncurryThis(''.matchAll);
var WORKS_WITH_NON_GLOBAL_REGEX = !!nativeMatchAll && !fails(function () {
  nativeMatchAll('a', /./);
});
var $RegExpStringIterator = createIteratorConstructor(function RegExpStringIterator(regexp, string, $global, fullUnicode) {
  setInternalState(this, {
    type: REGEXP_STRING_ITERATOR,
    regexp: regexp,
    string: string,
    global: $global,
    unicode: fullUnicode,
    done: false
  });
}, REGEXP_STRING, function next() {
  var state = getInternalState(this);
  if (state.done) return createIterResultObject(undefined, true);
  var R = state.regexp;
  var S = state.string;
  var match = regExpExec(R, S);
  if (match === null) {
    state.done = true;
    return createIterResultObject(undefined, true);
  }
  if (state.global) {
    if (toString(match[0]) === '') R.lastIndex = advanceStringIndex(S, toLength(R.lastIndex), state.unicode);
    return createIterResultObject(match, false);
  }
  state.done = true;
  return createIterResultObject(match, false);
});
var $matchAll = function (string) {
  var R = anObject(this);
  var S = toString(string);
  var C = speciesConstructor(R, RegExp);
  var flags = toString(getRegExpFlags(R));
  var matcher, $global, fullUnicode;
  matcher = new C(C === RegExp ? R.source : R, flags);
  $global = !!~stringIndexOf(flags, 'g');
  fullUnicode = !!~stringIndexOf(flags, 'u') || !!~stringIndexOf(flags, 'v');
  matcher.lastIndex = toLength(R.lastIndex);
  return new $RegExpStringIterator(matcher, S, $global, fullUnicode);
};

// `String.prototype.matchAll` method
// https://tc39.es/ecma262/#sec-string.prototype.matchall
$({
  target: 'String',
  proto: true,
  forced: WORKS_WITH_NON_GLOBAL_REGEX
}, {
  matchAll: function matchAll(regexp) {
    var O = requireObjectCoercible(this);
    var flags, S, matcher, rx;
    if (isObject(regexp)) {
      if (isRegExp(regexp)) {
        flags = toString(requireObjectCoercible(getRegExpFlags(regexp)));
        if (!~stringIndexOf(flags, 'g')) throw new $TypeError('`.matchAll` does not allow non-global regexes');
      }
      if (WORKS_WITH_NON_GLOBAL_REGEX) return nativeMatchAll(O, regexp);
      matcher = getMethod(regexp, MATCH_ALL);
      if (matcher === undefined && IS_PURE && classof(regexp) === 'RegExp') matcher = $matchAll;
      if (matcher) return call(matcher, regexp, O);
    } else if (WORKS_WITH_NON_GLOBAL_REGEX) return nativeMatchAll(O, regexp);
    S = toString(O);
    rx = new RegExp(regexp, 'g');
    return IS_PURE ? call($matchAll, rx, S) : rx[MATCH_ALL](S);
  }
});
IS_PURE || MATCH_ALL in RegExpPrototype || defineBuiltIn(RegExpPrototype, MATCH_ALL, $matchAll);
const _cjs_default = {};
export default _cjs_default;
