import $ from "../internals/export";
import symmetricDifference from "../internals/set-symmetric-difference";
import setMethodGetKeysBeforeCloning from "../internals/set-method-get-keys-before-cloning-detection";
import setMethodAcceptSetLike from "../internals/set-method-accept-set-like";
var FORCED = !setMethodAcceptSetLike('symmetricDifference') || !setMethodGetKeysBeforeCloning('symmetricDifference');

// `Set.prototype.symmetricDifference` method
// https://tc39.es/ecma262/#sec-set.prototype.symmetricdifference
$({
  target: 'Set',
  proto: true,
  real: true,
  forced: FORCED
}, {
  symmetricDifference: symmetricDifference
});
const _cjs_default = {};
export default _cjs_default;
