import $ from "../internals/export";
import _cjs_import from "../internals/async-iterator-iteration";
var $toArray = _cjs_import.toArray;

// `AsyncIterator.prototype.toArray` method
// https://github.com/tc39/proposal-async-iterator-helpers
$({
  target: 'AsyncIterator',
  proto: true,
  real: true,
  forced: true
}, {
  toArray: function toArray() {
    return $toArray(this, undefined, []);
  }
});
const _cjs_default = {};
export default _cjs_default;
