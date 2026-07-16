import $ from "../internals/export";
import aSet from "../internals/a-set";
import _cjs_import from "../internals/set-helpers";
var add = _cjs_import.add;

// `Set.prototype.addAll` method
// https://github.com/tc39/proposal-collection-methods
$({
  target: 'Set',
  proto: true,
  real: true,
  forced: true
}, {
  addAll: function addAll(/* ...elements */
  ) {
    var set = aSet(this);
    for (var k = 0, len = arguments.length; k < len; k++) {
      add(set, arguments[k]);
    }
    return set;
  }
});
const _cjs_default = {};
export default _cjs_default;
