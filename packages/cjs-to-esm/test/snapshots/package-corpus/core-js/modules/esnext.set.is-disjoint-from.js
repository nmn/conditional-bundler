import $ from "../internals/export";
import call from "../internals/function-call";
import toSetLike from "../internals/to-set-like";
import $isDisjointFrom from "../internals/set-is-disjoint-from";
// `Set.prototype.isDisjointFrom` method
// https://github.com/tc39/proposal-set-methods
// TODO: Obsolete version, remove from `core-js@4`
$({
  target: 'Set',
  proto: true,
  real: true,
  forced: true
}, {
  isDisjointFrom: function isDisjointFrom(other) {
    return call($isDisjointFrom, this, toSetLike(other));
  }
});
const _cjs_default = {};
export default _cjs_default;
