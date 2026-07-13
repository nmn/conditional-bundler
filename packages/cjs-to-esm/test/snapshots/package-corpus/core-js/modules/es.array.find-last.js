import $ from "../internals/export";
import { findLast as _findLast } from "../internals/array-iteration-from-last";
import addToUnscopables from "../internals/add-to-unscopables";
var $findLast = _findLast;
// `Array.prototype.findLast` method
// https://tc39.es/ecma262/#sec-array.prototype.findlast
$({
  target: 'Array',
  proto: true
}, {
  findLast: function findLast(callbackfn /* , that = undefined */) {
    return $findLast(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
  }
});
addToUnscopables('findLast');
const _cjs_default = {};
export default _cjs_default;
