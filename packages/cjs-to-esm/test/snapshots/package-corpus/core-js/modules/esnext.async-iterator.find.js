import $ from "../internals/export";
import _cjs_import from "../internals/async-iterator-iteration";
var $find = _cjs_import.find;

// `AsyncIterator.prototype.find` method
// https://github.com/tc39/proposal-async-iterator-helpers
$({
  target: 'AsyncIterator',
  proto: true,
  real: true,
  forced: true
}, {
  find: function find(predicate) {
    return $find(this, predicate);
  }
});
const _cjs_default = {};
export default _cjs_default;
