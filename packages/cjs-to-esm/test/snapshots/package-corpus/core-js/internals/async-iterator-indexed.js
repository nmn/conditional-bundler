import call from "../internals/function-call";
import map from "../internals/async-iterator-map";
var callback = function (value, counter) {
  return [counter, value];
};

// `AsyncIterator.prototype.indexed` method
// https://github.com/tc39/proposal-iterator-helpers
const _cjs_default = function indexed() {
  return call(map, this, callback);
};
export default _cjs_default;
