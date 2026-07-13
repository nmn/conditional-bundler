import DESCRIPTORS from "../internals/descriptors";
import addToUnscopables from "../internals/add-to-unscopables";
import toObject from "../internals/to-object";
import lengthOfArrayLike from "../internals/length-of-array-like";
import defineBuiltInAccessor from "../internals/define-built-in-accessor";
// TODO: Remove from `core-js@4`

// `Array.prototype.lastIndex` getter
// https://github.com/tc39/proposal-array-last
if (DESCRIPTORS) {
  defineBuiltInAccessor(Array.prototype, 'lastIndex', {
    configurable: true,
    get: function lastIndex() {
      var O = toObject(this);
      var len = lengthOfArrayLike(O);
      return len === 0 ? 0 : len - 1;
    }
  });
  addToUnscopables('lastIndex');
}
const _cjs_default = {};
export default _cjs_default;
