import $ from "../internals/export";
import iteratorWindow from "../internals/iterator-window";
// `Iterator.prototype.windows` method
// https://github.com/tc39/proposal-iterator-chunking
$({
  target: 'Iterator',
  proto: true,
  real: true,
  forced: true
}, {
  windows: function windows(windowSize /* , undersized */) {
    return iteratorWindow(this, windowSize, arguments.length < 2 ? undefined : arguments[1]);
  }
});
const _cjs_default = {};
export default _cjs_default;
