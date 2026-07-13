import $ from "../internals/export";
import { findLastIndex as _findLastIndex } from "../internals/array-iteration-from-last";
import addToUnscopables from "../internals/add-to-unscopables";
var $findLastIndex = _findLastIndex;
// `Array.prototype.findLastIndex` method
// https://tc39.es/ecma262/#sec-array.prototype.findlastindex
$({
  target: 'Array',
  proto: true
}, {
  findLastIndex: function findLastIndex(callbackfn /* , that = undefined */) {
    return $findLastIndex(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
  }
});
addToUnscopables('findLastIndex');
const _cjs_default = {};
export default _cjs_default;
