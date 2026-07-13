import { aTypedArray as _aTypedArray, exportTypedArrayMethod as _exportTypedArrayMethod } from "../internals/array-buffer-view-core";
import { map as _map } from "../internals/array-iteration";
import fromSameTypeAndList from "../internals/typed-array-from-same-type-and-list";
var $map = _map;
var aTypedArray = _aTypedArray;
var exportTypedArrayMethod = _exportTypedArrayMethod;

// `%TypedArray%.prototype.map` method
// https://tc39.es/ecma262/#sec-%typedarray%.prototype.map
exportTypedArrayMethod('map', function map(mapfn /* , thisArg */) {
  var list = $map(aTypedArray(this), mapfn, arguments.length > 1 ? arguments[1] : undefined);
  return fromSameTypeAndList(this, list);
});
const _cjs_default = {};
export default _cjs_default;
