import $ from "../internals/export";
import aWeakMap from "../internals/a-weak-map";
import { remove as _remove } from "../internals/weak-map-helpers";
var remove = _remove;

// `WeakMap.prototype.deleteAll` method
// https://github.com/tc39/proposal-collection-methods
$({
  target: 'WeakMap',
  proto: true,
  real: true,
  forced: true
}, {
  deleteAll: function deleteAll(/* ...elements */
  ) {
    var collection = aWeakMap(this);
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
