import aSet from "../internals/a-set";
import size from "../internals/set-size";
import iterate from "../internals/set-iterate";
import getSetRecord from "../internals/get-set-record";
// `Set.prototype.isSubsetOf` method
// https://tc39.es/ecma262/#sec-set.prototype.issubsetof
const _cjs_default = function isSubsetOf(other) {
  var O = aSet(this);
  var otherRec = getSetRecord(other);
  if (size(O) > otherRec.size) return false;
  return iterate(O, function (e) {
    if (!otherRec.includes(e)) return false;
  }, true) !== false;
};
export default _cjs_default;
