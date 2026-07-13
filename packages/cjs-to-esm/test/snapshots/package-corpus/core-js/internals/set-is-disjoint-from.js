import aSet from "../internals/a-set";
import { has as _has } from "../internals/set-helpers";
import size from "../internals/set-size";
import getSetRecord from "../internals/get-set-record";
import iterateSet from "../internals/set-iterate";
import iterateSimple from "../internals/iterate-simple";
import iteratorClose from "../internals/iterator-close";
var has = _has;
// `Set.prototype.isDisjointFrom` method
// https://tc39.es/ecma262/#sec-set.prototype.isdisjointfrom
const _cjs_default = function isDisjointFrom(other) {
  var O = aSet(this);
  var otherRec = getSetRecord(other);
  if (size(O) <= otherRec.size) return iterateSet(O, function (e) {
    if (otherRec.includes(e)) return false;
  }, true) !== false;
  var iterator = otherRec.getIterator();
  return iterateSimple(iterator, function (e) {
    if (has(O, e)) return iteratorClose(iterator.iterator, 'normal', false);
  }) !== false;
};
export default _cjs_default;
