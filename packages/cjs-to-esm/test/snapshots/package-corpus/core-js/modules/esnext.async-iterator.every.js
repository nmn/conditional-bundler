import $ from "../internals/export";
import { every as _every } from "../internals/async-iterator-iteration";
var $every = _every;

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
