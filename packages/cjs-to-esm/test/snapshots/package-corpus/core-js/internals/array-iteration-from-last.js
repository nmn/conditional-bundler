import bind from "../internals/function-bind-context";
import IndexedObject from "../internals/indexed-object";
import toObject from "../internals/to-object";
import lengthOfArrayLike from "../internals/length-of-array-like";
// `Array.prototype.{ findLast, findLastIndex }` methods implementation
var createMethod = function (TYPE) {
  var IS_FIND_LAST_INDEX = TYPE === 1;
  return function ($this, callbackfn, that) {
    var O = toObject($this);
    var self = IndexedObject(O);
    var index = lengthOfArrayLike(self);
    var boundFunction = bind(callbackfn, that);
    var value, result;
    while (index-- > 0) {
      value = self[index];
      result = boundFunction(value, index, O);
      if (result) switch (TYPE) {
        case 0:
          return value;
        // findLast
        case 1:
          return index;
        // findLastIndex
      }
    }
    return IS_FIND_LAST_INDEX ? -1 : undefined;
  };
};
const _cjs_default = {
  // `Array.prototype.findLast` method
  // https://github.com/tc39/proposal-array-find-from-last
  findLast: createMethod(0),
  // `Array.prototype.findLastIndex` method
  // https://github.com/tc39/proposal-array-find-from-last
  findLastIndex: createMethod(1)
};
const _findLast = _cjs_default["findLast"];
export { _findLast as findLast };
const _findLastIndex = _cjs_default["findLastIndex"];
export { _findLastIndex as findLastIndex };
export default _cjs_default;
