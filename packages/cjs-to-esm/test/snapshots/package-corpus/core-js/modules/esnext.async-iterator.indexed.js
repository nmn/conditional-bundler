import $ from "../internals/export";
import indexed from "../internals/async-iterator-indexed";
// TODO: Remove from `core-js@4`

// `AsyncIterator.prototype.indexed` method
// https://github.com/tc39/proposal-iterator-helpers
$({
  target: 'AsyncIterator',
  proto: true,
  real: true,
  forced: true
}, {
  indexed: indexed
});
const _cjs_default = {};
export default _cjs_default;
