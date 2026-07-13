import $ from "../internals/export";
import call from "../internals/function-call";
import toSetLike from "../internals/to-set-like";
import $union from "../internals/set-union";
// `Set.prototype.union` method
// https://github.com/tc39/proposal-set-methods
// TODO: Obsolete version, remove from `core-js@4`
$({
  target: 'Set',
  proto: true,
  real: true,
  forced: true
}, {
  union: function union(other) {
    return call($union, this, toSetLike(other));
  }
});
const _cjs_default = {};
export default _cjs_default;
