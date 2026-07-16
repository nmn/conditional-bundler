import $ from "../internals/export";
import _cjs_import from "../internals/async-iterator-iteration";
var $some = _cjs_import.some;

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
