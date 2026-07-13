import { aTypedArray as _aTypedArray, exportTypedArrayMethod as _exportTypedArrayMethod } from "../internals/array-buffer-view-core";
import { filterReject as _filterReject } from "../internals/array-iteration";
import fromSameTypeAndList from "../internals/typed-array-from-same-type-and-list";
// TODO: Remove from `core-js@4`

var $filterReject = _filterReject;
var aTypedArray = _aTypedArray;
var exportTypedArrayMethod = _exportTypedArrayMethod;

// `%TypedArray%.prototype.filterOut` method
// https://github.com/tc39/proposal-array-filtering
exportTypedArrayMethod('filterOut', function filterOut(callbackfn /* , thisArg */) {
  var list = $filterReject(aTypedArray(this), callbackfn, arguments.length > 1 ? arguments[1] : undefined);
  return fromSameTypeAndList(this, list);
}, true);
const _cjs_default = {};
export default _cjs_default;
