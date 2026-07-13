import $ from "../internals/export";
import isSubsetOf from "../internals/set-is-subset-of";
import setMethodAcceptSetLike from "../internals/set-method-accept-set-like";
var INCORRECT = !setMethodAcceptSetLike('isSubsetOf', function (result) {
  return result;
});

// `Set.prototype.isSubsetOf` method
// https://tc39.es/ecma262/#sec-set.prototype.issubsetof
$({
  target: 'Set',
  proto: true,
  real: true,
  forced: INCORRECT
}, {
  isSubsetOf: isSubsetOf
});
const _cjs_default = {};
export default _cjs_default;
