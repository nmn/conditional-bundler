import $ from "../internals/export";
import aSet from "../internals/a-set";
import _cjs_import from "../internals/set-helpers";
var remove = _cjs_import.remove;

// `Set.prototype.deleteAll` method
// https://github.com/tc39/proposal-collection-methods
$({
  target: 'Set',
  proto: true,
  real: true,
  forced: true
}, {
  deleteAll: function deleteAll(/* ...elements */
  ) {
    var collection = aSet(this);
    var allDeleted = true;
    var wasDeleted;
    for (var k = 0, len = arguments.length; k < len; k++) {
      wasDeleted = remove(collection, arguments[k]);
      allDeleted = allDeleted && wasDeleted;
    }
    return !!allDeleted;
  }
});
const _cjs_default = {};
export default _cjs_default;
