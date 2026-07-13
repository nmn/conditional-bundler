import $ from "../internals/export";
import call from "../internals/function-call";
import toSetLike from "../internals/to-set-like";
import $isSupersetOf from "../internals/set-is-superset-of";
// `Set.prototype.isSupersetOf` method
// https://github.com/tc39/proposal-set-methods
// TODO: Obsolete version, remove from `core-js@4`
$({
  target: 'Set',
  proto: true,
  real: true,
  forced: true
}, {
  isSupersetOf: function isSupersetOf(other) {
    return call($isSupersetOf, this, toSetLike(other));
  }
});
const _cjs_default = {};
export default _cjs_default;
