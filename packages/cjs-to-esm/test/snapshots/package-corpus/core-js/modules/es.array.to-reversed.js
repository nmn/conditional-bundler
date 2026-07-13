import $ from "../internals/export";
import lengthOfArrayLike from "../internals/length-of-array-like";
import toIndexedObject from "../internals/to-indexed-object";
import createProperty from "../internals/create-property";
import addToUnscopables from "../internals/add-to-unscopables";
var $Array = Array;

// `Array.prototype.toReversed` method
// https://tc39.es/ecma262/#sec-array.prototype.toreversed
$({
  target: 'Array',
  proto: true
}, {
  toReversed: function toReversed() {
    var O = toIndexedObject(this);
    var len = lengthOfArrayLike(O);
    var A = new $Array(len);
    var k = 0;
    for (; k < len; k++) createProperty(A, k, O[len - k - 1]);
    return A;
  }
});
addToUnscopables('toReversed');
const _cjs_default = {};
export default _cjs_default;
