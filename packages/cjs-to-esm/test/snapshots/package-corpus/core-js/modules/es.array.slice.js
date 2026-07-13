import $ from "../internals/export";
import isArray from "../internals/is-array";
import isConstructor from "../internals/is-constructor";
import isObject from "../internals/is-object";
import toAbsoluteIndex from "../internals/to-absolute-index";
import lengthOfArrayLike from "../internals/length-of-array-like";
import toIndexedObject from "../internals/to-indexed-object";
import createProperty from "../internals/create-property";
import setArrayLength from "../internals/array-set-length";
import wellKnownSymbol from "../internals/well-known-symbol";
import arrayMethodHasSpeciesSupport from "../internals/array-method-has-species-support";
import nativeSlice from "../internals/array-slice";
var HAS_SPECIES_SUPPORT = arrayMethodHasSpeciesSupport('slice');
var SPECIES = wellKnownSymbol('species');
var $Array = Array;
var max = Math.max;

// `Array.prototype.slice` method
// https://tc39.es/ecma262/#sec-array.prototype.slice
// fallback for not array-like ES3 strings and DOM objects
$({
  target: 'Array',
  proto: true,
  forced: !HAS_SPECIES_SUPPORT
}, {
  slice: function slice(start, end) {
    var O = toIndexedObject(this);
    var length = lengthOfArrayLike(O);
    var k = toAbsoluteIndex(start, length);
    var fin = toAbsoluteIndex(end === undefined ? length : end, length);
    // inline `ArraySpeciesCreate` for usage native `Array#slice` where it's possible
    var Constructor, result, n;
    if (isArray(O)) {
      Constructor = O.constructor;
      // cross-realm fallback
      if (isConstructor(Constructor) && (Constructor === $Array || isArray(Constructor.prototype))) {
        Constructor = undefined;
      } else if (isObject(Constructor)) {
        Constructor = Constructor[SPECIES];
        if (Constructor === null) Constructor = undefined;
      }
      if (Constructor === $Array || Constructor === undefined) {
        return nativeSlice(O, k, fin);
      }
    }
    result = new (Constructor === undefined ? $Array : Constructor)(max(fin - k, 0));
    for (n = 0; k < fin; k++, n++) if (k in O) createProperty(result, n, O[k]);
    setArrayLength(result, n);
    return result;
  }
});
const _cjs_default = {};
export default _cjs_default;
