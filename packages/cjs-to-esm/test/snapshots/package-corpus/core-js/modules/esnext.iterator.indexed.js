import $ from "../internals/export";
import indexed from "../internals/iterator-indexed";
// TODO: Remove from `core-js@4`

// `Iterator.prototype.indexed` method
// https://github.com/tc39/proposal-iterator-helpers
$({
  target: 'Iterator',
  proto: true,
  real: true,
  forced: true
}, {
  indexed: indexed
});
const _cjs_default = {};
export default _cjs_default;
