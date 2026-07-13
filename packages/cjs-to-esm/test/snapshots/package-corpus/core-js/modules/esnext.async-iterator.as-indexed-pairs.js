import $ from "../internals/export";
import indexed from "../internals/async-iterator-indexed";
// TODO: Remove from `core-js@4`

// `AsyncIterator.prototype.asIndexedPairs` method
// https://github.com/tc39/proposal-iterator-helpers
$({
  target: 'AsyncIterator',
  name: 'indexed',
  proto: true,
  real: true,
  forced: true
}, {
  asIndexedPairs: indexed
});
const _cjs_default = {};
export default _cjs_default;
