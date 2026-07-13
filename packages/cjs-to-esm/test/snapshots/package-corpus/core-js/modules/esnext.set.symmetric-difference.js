import $ from "../internals/export";
import call from "../internals/function-call";
import toSetLike from "../internals/to-set-like";
import $symmetricDifference from "../internals/set-symmetric-difference";
// `Set.prototype.symmetricDifference` method
// https://github.com/tc39/proposal-set-methods
// TODO: Obsolete version, remove from `core-js@4`
$({
  target: 'Set',
  proto: true,
  real: true,
  forced: true
}, {
  symmetricDifference: function symmetricDifference(other) {
    return call($symmetricDifference, this, toSetLike(other));
  }
});
const _cjs_default = {};
export default _cjs_default;
