import $ from "../internals/export";
import _cjs_import from "../internals/async-iterator-iteration";
var $every = _cjs_import.every;

// `AsyncIterator.prototype.every` method
// https://github.com/tc39/proposal-async-iterator-helpers
$({
  target: 'AsyncIterator',
  proto: true,
  real: true,
  forced: true
}, {
  every: function every(predicate) {
    return $every(this, predicate);
  }
});
const _cjs_default = {};
export default _cjs_default;
