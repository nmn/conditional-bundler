import $ from "../internals/export";
import { forEach as _forEach } from "../internals/async-iterator-iteration";
var $forEach = _forEach;

// `AsyncIterator.prototype.forEach` method
// https://github.com/tc39/proposal-async-iterator-helpers
$({
  target: 'AsyncIterator',
  proto: true,
  real: true,
  forced: true
}, {
  forEach: function forEach(fn) {
    return $forEach(this, fn);
  }
});
const _cjs_default = {};
export default _cjs_default;
