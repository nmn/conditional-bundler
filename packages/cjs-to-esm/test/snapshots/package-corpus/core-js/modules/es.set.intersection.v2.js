import $ from "../internals/export";
import fails from "../internals/fails";
import intersection from "../internals/set-intersection";
import setMethodAcceptSetLike from "../internals/set-method-accept-set-like";
var INCORRECT = !setMethodAcceptSetLike('intersection', function (result) {
  return result.size === 2 && result.has(1) && result.has(2);
}) || fails(function () {
  // eslint-disable-next-line es/no-array-from, es/no-set, es/no-set-prototype-intersection -- testing
  return String(Array.from(new Set([1, 2, 3]).intersection(new Set([3, 2])))) !== '3,2';
});

// `Set.prototype.intersection` method
// https://tc39.es/ecma262/#sec-set.prototype.intersection
$({
  target: 'Set',
  proto: true,
  real: true,
  forced: INCORRECT
}, {
  intersection: intersection
});
const _cjs_default = {};
export default _cjs_default;
