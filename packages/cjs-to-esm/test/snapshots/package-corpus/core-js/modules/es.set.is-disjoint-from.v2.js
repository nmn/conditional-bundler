import $ from "../internals/export";
import isDisjointFrom from "../internals/set-is-disjoint-from";
import setMethodAcceptSetLike from "../internals/set-method-accept-set-like";
var INCORRECT = !setMethodAcceptSetLike('isDisjointFrom', function (result) {
  return !result;
});

// `Set.prototype.isDisjointFrom` method
// https://tc39.es/ecma262/#sec-set.prototype.isdisjointfrom
$({
  target: 'Set',
  proto: true,
  real: true,
  forced: INCORRECT
}, {
  isDisjointFrom: isDisjointFrom
});
const _cjs_default = {};
export default _cjs_default;
