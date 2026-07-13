import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this-clause";
import { f as _f } from "../internals/object-get-own-property-descriptor";
import toLength from "../internals/to-length";
import toString from "../internals/to-string";
import notARegExp from "../internals/not-a-regexp";
import requireObjectCoercible from "../internals/require-object-coercible";
import correctIsRegExpLogic from "../internals/correct-is-regexp-logic";
import IS_PURE from "../internals/is-pure";
var getOwnPropertyDescriptor = _f;
var stringSlice = uncurryThis(''.slice);
var min = Math.min;
var CORRECT_IS_REGEXP_LOGIC = correctIsRegExpLogic('startsWith');
// https://github.com/zloirock/core-js/pull/702
var MDN_POLYFILL_BUG = !IS_PURE && !CORRECT_IS_REGEXP_LOGIC && !!function () {
  var descriptor = getOwnPropertyDescriptor(String.prototype, 'startsWith');
  return descriptor && !descriptor.writable;
}();

// `String.prototype.startsWith` method
// https://tc39.es/ecma262/#sec-string.prototype.startswith
$({
  target: 'String',
  proto: true,
  forced: !MDN_POLYFILL_BUG && !CORRECT_IS_REGEXP_LOGIC
}, {
  startsWith: function startsWith(searchString /* , position = 0 */) {
    var that = toString(requireObjectCoercible(this));
    notARegExp(searchString);
    var search = toString(searchString);
    var index = toLength(min(arguments.length > 1 ? arguments[1] : undefined, that.length));
    return stringSlice(that, index, index + search.length) === search;
  }
});
const _cjs_default = {};
export default _cjs_default;
