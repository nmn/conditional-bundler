import $ from "../internals/export";
import _cjs_import from "../internals/array-iteration";
import addToUnscopables from "../internals/add-to-unscopables";
// TODO: remove from `core-js@4`

var $filterReject = _cjs_import.filterReject;
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
