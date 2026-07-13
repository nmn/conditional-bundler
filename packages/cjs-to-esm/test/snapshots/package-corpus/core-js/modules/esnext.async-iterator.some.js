import $ from "../internals/export";
import { some as _some } from "../internals/async-iterator-iteration";
var $some = _some;

// `AsyncIterator.prototype.some` method
// https://github.com/tc39/proposal-async-iterator-helpers
$({
  target: 'AsyncIterator',
  proto: true,
  real: true,
  forced: true
}, {
  some: function some(predicate) {
    return $some(this, predicate);
  }
});
const _cjs_default = {};
export default _cjs_default;
