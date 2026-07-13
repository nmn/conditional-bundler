import $ from "../internals/export";
import $group from "../internals/array-group";
import arrayMethodIsStrict from "../internals/array-method-is-strict";
import addToUnscopables from "../internals/add-to-unscopables";
// TODO: Remove from `core-js@4`

// `Array.prototype.groupBy` method
// https://github.com/tc39/proposal-array-grouping
// https://bugs.webkit.org/show_bug.cgi?id=236541
$({
  target: 'Array',
  proto: true,
  forced: !arrayMethodIsStrict('groupBy')
}, {
  groupBy: function groupBy(callbackfn /* , thisArg */) {
    var thisArg = arguments.length > 1 ? arguments[1] : undefined;
    return $group(this, callbackfn, thisArg);
  }
});
addToUnscopables('groupBy');
const _cjs_default = {};
export default _cjs_default;
