import aSet from "../internals/a-set";
import { Set as _Set, add as _add, has as _has } from "../internals/set-helpers";
import size from "../internals/set-size";
import getSetRecord from "../internals/get-set-record";
import iterateSet from "../internals/set-iterate";
import iterateSimple from "../internals/iterate-simple";
var Set = _Set;
var add = _add;
var has = _has;

// `Set.prototype.intersection` method
// https://tc39.es/ecma262/#sec-set.prototype.intersection
const _cjs_default = function intersection(other) {
  var O = aSet(this);
  var otherRec = getSetRecord(other);
  var result = new Set();
  if (size(O) > otherRec.size) {
    iterateSimple(otherRec.getIterator(), function (e) {
      if (has(O, e)) add(result, e);
    });
  } else {
    iterateSet(O, function (e) {
      if (otherRec.includes(e)) add(result, e);
    });
  }
  return result;
};
export default _cjs_default;
