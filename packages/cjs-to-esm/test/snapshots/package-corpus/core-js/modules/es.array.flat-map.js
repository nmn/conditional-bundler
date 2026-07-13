import $ from "../internals/export";
import flattenIntoArray from "../internals/flatten-into-array";
import aCallable from "../internals/a-callable";
import toObject from "../internals/to-object";
import lengthOfArrayLike from "../internals/length-of-array-like";
import arraySpeciesCreate from "../internals/array-species-create";
// `Array.prototype.flatMap` method
// https://tc39.es/ecma262/#sec-array.prototype.flatmap
$({
  target: 'Array',
  proto: true
}, {
  flatMap: function flatMap(callbackfn /* , thisArg */) {
    var O = toObject(this);
    var sourceLen = lengthOfArrayLike(O);
    var A;
    aCallable(callbackfn);
    A = arraySpeciesCreate(O, 0);
    flattenIntoArray(A, O, O, sourceLen, 0, 1, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
    return A;
  }
});
const _cjs_default = {};
export default _cjs_default;
