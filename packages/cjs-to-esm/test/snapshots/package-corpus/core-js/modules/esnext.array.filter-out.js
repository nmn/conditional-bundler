import $ from "../internals/export";
import { filterReject as _filterReject } from "../internals/array-iteration";
import addToUnscopables from "../internals/add-to-unscopables";
// TODO: remove from `core-js@4`

var $filterReject = _filterReject;
// `Array.prototype.filterOut` method
// https://github.com/tc39/proposal-array-filtering
$({
  target: 'Array',
  proto: true,
  forced: true
}, {
  filterOut: function filterOut(callbackfn /* , thisArg */) {
    return $filterReject(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
  }
});
addToUnscopables('filterOut');
const _cjs_default = {};
export default _cjs_default;
