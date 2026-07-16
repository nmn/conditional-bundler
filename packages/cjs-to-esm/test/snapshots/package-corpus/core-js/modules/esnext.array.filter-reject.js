import $ from "../internals/export";
import _cjs_import from "../internals/array-iteration";
import addToUnscopables from "../internals/add-to-unscopables";
var $filterReject = _cjs_import.filterReject;
// `Array.prototype.filterReject` method
// https://github.com/tc39/proposal-array-filtering
$({
  target: 'Array',
  proto: true,
  forced: true
}, {
  filterReject: function filterReject(callbackfn /* , thisArg */) {
    return $filterReject(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
  }
});
addToUnscopables('filterReject');
const _cjs_default = {};
export default _cjs_default;
