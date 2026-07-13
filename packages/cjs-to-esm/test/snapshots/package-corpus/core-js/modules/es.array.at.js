import $ from "../internals/export";
import toObject from "../internals/to-object";
import lengthOfArrayLike from "../internals/length-of-array-like";
import toIntegerOrInfinity from "../internals/to-integer-or-infinity";
import addToUnscopables from "../internals/add-to-unscopables";
// `Array.prototype.at` method
// https://tc39.es/ecma262/#sec-array.prototype.at
$({
  target: 'Array',
  proto: true
}, {
  at: function at(index) {
    var O = toObject(this);
    var len = lengthOfArrayLike(O);
    var relativeIndex = toIntegerOrInfinity(index);
    var k = relativeIndex >= 0 ? relativeIndex : len + relativeIndex;
    return k < 0 || k >= len ? undefined : O[k];
  }
});
addToUnscopables('at');
const _cjs_default = {};
export default _cjs_default;
