import aSet from "../internals/a-set";
import { add as _add } from "../internals/set-helpers";
import clone from "../internals/set-clone";
import getSetRecord from "../internals/get-set-record";
import iterateSimple from "../internals/iterate-simple";
var add = _add;
// `Set.prototype.union` method
// https://tc39.es/ecma262/#sec-set.prototype.union
const _cjs_default = function union(other) {
  var O = aSet(this);
  var keysIter = getSetRecord(other).getIterator();
  var result = clone(O);
  iterateSimple(keysIter, function (it) {
    add(result, it);
  });
  return result;
};
export default _cjs_default;
