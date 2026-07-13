import $ from "../internals/export";
import call from "../internals/function-call";
import toSetLike from "../internals/to-set-like";
import $difference from "../internals/set-difference";
// `Set.prototype.difference` method
// https://github.com/tc39/proposal-set-methods
// TODO: Obsolete version, remove from `core-js@4`
$({
  target: 'Set',
  proto: true,
  real: true,
  forced: true
}, {
  difference: function difference(other) {
    return call($difference, this, toSetLike(other));
  }
});
const _cjs_default = {};
export default _cjs_default;
