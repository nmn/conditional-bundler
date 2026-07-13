import $ from "../internals/export";
import flattenIntoArray from "../internals/flatten-into-array";
import toObject from "../internals/to-object";
import lengthOfArrayLike from "../internals/length-of-array-like";
import toIntegerOrInfinity from "../internals/to-integer-or-infinity";
import arraySpeciesCreate from "../internals/array-species-create";
// `Array.prototype.flat` method
// https://tc39.es/ecma262/#sec-array.prototype.flat
$({
  target: 'Array',
  proto: true
}, {
  flat: function flat(/* depthArg = 1 */
  ) {
    var depthArg = arguments.length ? arguments[0] : undefined;
    var O = toObject(this);
    var sourceLen = lengthOfArrayLike(O);
    var depthNum = depthArg === undefined ? 1 : toIntegerOrInfinity(depthArg);
    var A = arraySpeciesCreate(O, 0);
    flattenIntoArray(A, O, O, sourceLen, 0, depthNum);
    return A;
  }
});
const _cjs_default = {};
export default _cjs_default;
