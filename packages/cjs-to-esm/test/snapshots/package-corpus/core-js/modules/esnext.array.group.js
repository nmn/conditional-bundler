import $ from "../internals/export";
import $group from "../internals/array-group";
import addToUnscopables from "../internals/add-to-unscopables";
// `Array.prototype.group` method
// https://github.com/tc39/proposal-array-grouping
$({
  target: 'Array',
  proto: true
}, {
  group: function group(callbackfn /* , thisArg */) {
    var thisArg = arguments.length > 1 ? arguments[1] : undefined;
    return $group(this, callbackfn, thisArg);
  }
});
addToUnscopables('group');
const _cjs_default = {};
export default _cjs_default;
