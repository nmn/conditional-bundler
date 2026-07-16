import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this-clause";
import _cjs_import from "../internals/object-get-own-property-descriptor";
import toLength from "../internals/to-length";
import toString from "../internals/to-string";
import notARegExp from "../internals/not-a-regexp";
import requireObjectCoercible from "../internals/require-object-coercible";
import correctIsRegExpLogic from "../internals/correct-is-regexp-logic";
import IS_PURE from "../internals/is-pure";
var getOwnPropertyDescriptor = _cjs_import.f;
var slice = uncurryThis(''.slice);
var min = Math.min;
var CORRECT_IS_REGEXP_LOGIC = correctIsRegExpLogic('endsWith');
// https://github.com/zloirock/core-js/pull/702
var MDN_POLYFILL_BUG = !IS_PURE && !CORRECT_IS_REGEXP_LOGIC && !!function () {
  var descriptor = getOwnPropertyDescriptor(String.prototype, 'endsWith');
  return descriptor && !descriptor.writable;
}();

// `String.prototype.endsWith` method
// https://tc39.es/ecma262/#sec-string.prototype.endswith
$({
  target: 'String',
  proto: true,
  forced: !MDN_POLYFILL_BUG && !CORRECT_IS_REGEXP_LOGIC
}, {
  endsWith: function endsWith(searchString /* , endPosition = @length */) {
    var that = toString(requireObjectCoercible(this));
    notARegExp(searchString);
    var search = toString(searchString);
    var endPosition = arguments.length > 1 ? arguments[1] : undefined;
    var len = that.length;
    var end = endPosition === undefined ? len : min(toLength(endPosition), len);
    return slice(that, end - search.length, end) === search;
  }
});
const _cjs_default = {};
export default _cjs_default;
