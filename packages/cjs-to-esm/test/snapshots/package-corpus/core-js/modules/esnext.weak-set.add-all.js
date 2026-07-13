import $ from "../internals/export";
import aWeakSet from "../internals/a-weak-set";
import { add as _add } from "../internals/weak-set-helpers";
var add = _add;

// `WeakSet.prototype.addAll` method
// https://github.com/tc39/proposal-collection-methods
$({
  target: 'WeakSet',
  proto: true,
  real: true,
  forced: true
}, {
  addAll: function addAll(/* ...elements */
  ) {
    var set = aWeakSet(this);
    for (var k = 0, len = arguments.length; k < len; k++) {
      add(set, arguments[k]);
    }
    return set;
  }
});
const _cjs_default = {};
export default _cjs_default;
