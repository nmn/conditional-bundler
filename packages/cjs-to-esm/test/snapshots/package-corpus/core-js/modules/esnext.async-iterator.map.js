import $ from "../internals/export";
import map from "../internals/async-iterator-map";
// `AsyncIterator.prototype.map` method
// https://github.com/tc39/proposal-async-iterator-helpers
$({
  target: 'AsyncIterator',
  proto: true,
  real: true,
  forced: true
}, {
  map: map
});
const _cjs_default = {};
export default _cjs_default;
