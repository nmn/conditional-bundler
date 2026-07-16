import $ from "../internals/export";
import bind from "../internals/function-bind-context";
import aSet from "../internals/a-set";
import SetHelpers from "../internals/set-helpers";
import iterate from "../internals/set-iterate";
var Set = SetHelpers.Set;
var add = SetHelpers.add;

// `Set.prototype.map` method
// https://github.com/tc39/proposal-collection-methods
$({
  target: 'Set',
  proto: true,
  real: true,
  forced: true
}, {
  map: function map(callbackfn /* , thisArg */) {
    var set = aSet(this);
    var boundFunction = bind(callbackfn, arguments.length > 1 ? arguments[1] : undefined);
    var newSet = new Set();
    iterate(set, function (value) {
      add(newSet, boundFunction(value, value, set));
    });
    return newSet;
  }
});
const _cjs_default = {};
export default _cjs_default;
