import $ from "../internals/export";
import aWeakSet from "../internals/a-weak-set";
import _cjs_import from "../internals/weak-set-helpers";
var remove = _cjs_import.remove;

// `WeakSet.prototype.deleteAll` method
// https://github.com/tc39/proposal-collection-methods
$({
  target: 'WeakSet',
  proto: true,
  real: true,
  forced: true
}, {
  deleteAll: function deleteAll(/* ...elements */
  ) {
    var collection = aWeakSet(this);
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
