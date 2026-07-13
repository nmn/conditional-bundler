import $ from "../internals/export";
import call from "../internals/function-call";
import toSetLike from "../internals/to-set-like";
import $isSubsetOf from "../internals/set-is-subset-of";
// `Set.prototype.isSubsetOf` method
// https://github.com/tc39/proposal-set-methods
// TODO: Obsolete version, remove from `core-js@4`
$({
  target: 'Set',
  proto: true,
  real: true,
  forced: true
}, {
  isSubsetOf: function isSubsetOf(other) {
    return call($isSubsetOf, this, toSetLike(other));
  }
});
const _cjs_default = {};
export default _cjs_default;
