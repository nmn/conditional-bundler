import aSet from "../internals/a-set";
import SetHelpers from "../internals/set-helpers";
import clone from "../internals/set-clone";
import getSetRecord from "../internals/get-set-record";
import iterateSimple from "../internals/iterate-simple";
var add = SetHelpers.add;
var has = SetHelpers.has;
var remove = SetHelpers.remove;

// `Set.prototype.symmetricDifference` method
// https://tc39.es/ecma262/#sec-set.prototype.symmetricdifference
const _cjs_default = function symmetricDifference(other) {
  var O = aSet(this);
  var keysIter = getSetRecord(other).getIterator();
  var result = clone(O);
  iterateSimple(keysIter, function (e) {
    if (has(O, e)) remove(result, e);else add(result, e);
  });
  return result;
};
export default _cjs_default;
