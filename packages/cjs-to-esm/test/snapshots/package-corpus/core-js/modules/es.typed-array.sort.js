import globalThis from "../internals/global-this";
import uncurryThis from "../internals/function-uncurry-this-clause";
import fails from "../internals/fails";
import aCallable from "../internals/a-callable";
import internalSort from "../internals/array-sort";
import { aTypedArray as _aTypedArray, exportTypedArrayMethod as _exportTypedArrayMethod } from "../internals/array-buffer-view-core";
import FF from "../internals/environment-ff-version";
import IE_OR_EDGE from "../internals/environment-is-ie-or-edge";
import V8 from "../internals/environment-v8-version";
import WEBKIT from "../internals/environment-webkit-version";
var aTypedArray = _aTypedArray;
var exportTypedArrayMethod = _exportTypedArrayMethod;
var Uint16Array = globalThis.Uint16Array;
var nativeSort = Uint16Array && uncurryThis(Uint16Array.prototype.sort);

// WebKit
var ACCEPT_INCORRECT_ARGUMENTS = !!nativeSort && !(fails(function () {
  nativeSort(new Uint16Array(2), null);
}) && fails(function () {
  nativeSort(new Uint16Array(2), {});
}));
var STABLE_SORT = !!nativeSort && !fails(function () {
  // feature detection can be too slow, so check engines versions
  if (V8) return V8 < 74;
  if (FF) return FF < 67;
  if (IE_OR_EDGE) return true;
  if (WEBKIT) return WEBKIT < 602;
  var array = new Uint16Array(516);
  var expected = Array(516);
  var index, mod;
  for (index = 0; index < 516; index++) {
    mod = index % 4;
    array[index] = 515 - index;
    expected[index] = index - 2 * mod + 3;
  }
  nativeSort(array, function (a, b) {
    return (a / 4 | 0) - (b / 4 | 0);
  });
  for (index = 0; index < 516; index++) {
    if (array[index] !== expected[index]) return true;
  }
});
var getSortCompare = function (comparefn) {
  return function (x, y) {
    if (comparefn !== undefined) return +comparefn(x, y) || 0;
    // eslint-disable-next-line no-self-compare -- NaN check
    if (y !== y) return x !== x ? 0 : -1;
    // eslint-disable-next-line no-self-compare -- NaN check
    if (x !== x) return 1;
    if (x === 0 && y === 0) return 1 / x > 0 ? 1 / y > 0 ? 0 : 1 : 1 / y > 0 ? -1 : 0;
    return x > y ? 1 : x < y ? -1 : 0;
  };
};

// `%TypedArray%.prototype.sort` method
// https://tc39.es/ecma262/#sec-%typedarray%.prototype.sort
exportTypedArrayMethod('sort', function sort(comparefn) {
  if (comparefn !== undefined) aCallable(comparefn);
  if (STABLE_SORT) return nativeSort(this, comparefn);
  return internalSort(aTypedArray(this), getSortCompare(comparefn));
}, !STABLE_SORT || ACCEPT_INCORRECT_ARGUMENTS);
const _cjs_default = {};
export default _cjs_default;
