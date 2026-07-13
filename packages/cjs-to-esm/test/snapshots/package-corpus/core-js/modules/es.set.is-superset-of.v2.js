import $ from "../internals/export";
import isSupersetOf from "../internals/set-is-superset-of";
import setMethodAcceptSetLike from "../internals/set-method-accept-set-like";
var INCORRECT = !setMethodAcceptSetLike('isSupersetOf', function (result) {
  return !result;
});

// `Set.prototype.isSupersetOf` method
// https://tc39.es/ecma262/#sec-set.prototype.issupersetof
$({
  target: 'Set',
  proto: true,
  real: true,
  forced: INCORRECT
}, {
  isSupersetOf: isSupersetOf
});
const _cjs_default = {};
export default _cjs_default;
