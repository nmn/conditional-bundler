import aSet from "../internals/a-set";
import SetHelpers from "../internals/set-helpers";
import clone from "../internals/set-clone";
import size from "../internals/set-size";
import getSetRecord from "../internals/get-set-record";
import iterateSet from "../internals/set-iterate";
import iterateSimple from "../internals/iterate-simple";
var has = SetHelpers.has;
var remove = SetHelpers.remove;

// `Set.prototype.difference` method
// https://tc39.es/ecma262/#sec-set.prototype.difference
const _cjs_default = function difference(other) {
  var O = aSet(this);
  var otherRec = getSetRecord(other);
  var result = clone(O);
  if (size(result) <= otherRec.size) iterateSet(result, function (e) {
    if (otherRec.includes(e)) remove(result, e);
  });else iterateSimple(otherRec.getIterator(), function (e) {
    if (has(result, e)) remove(result, e);
  });
  return result;
};
export default _cjs_default;
