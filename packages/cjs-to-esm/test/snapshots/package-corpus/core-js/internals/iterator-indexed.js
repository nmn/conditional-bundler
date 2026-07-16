import "../modules/es.iterator.map";
import call from "../internals/function-call";
import _cjs_import from "../internals/iterators-core";
var map = _cjs_import.IteratorPrototype.map;
var callback = function (value, counter) {
  return [counter, value];
};

// `Iterator.prototype.indexed` method
// https://github.com/tc39/proposal-iterator-helpers
const _cjs_default = function indexed() {
  return call(map, this, callback);
};
export default _cjs_default;
