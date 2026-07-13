import $ from "../internals/export";
import bind from "../internals/function-bind-context";
import aSet from "../internals/a-set";
import { Set as _Set, add as _add } from "../internals/set-helpers";
import iterate from "../internals/set-iterate";
var Set = _Set;
var add = _add;

// `Set.prototype.filter` method
// https://github.com/tc39/proposal-collection-methods
$({
  target: 'Set',
  proto: true,
  real: true,
  forced: true
}, {
  filter: function filter(callbackfn /* , thisArg */) {
    var set = aSet(this);
    var boundFunction = bind(callbackfn, arguments.length > 1 ? arguments[1] : undefined);
    var newSet = new Set();
    iterate(set, function (value) {
      if (boundFunction(value, value, set)) add(newSet, value);
    });
    return newSet;
  }
});
const _cjs_default = {};
export default _cjs_default;
