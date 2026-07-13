import $ from "../internals/export";
import union from "../internals/set-union";
import setMethodGetKeysBeforeCloning from "../internals/set-method-get-keys-before-cloning-detection";
import setMethodAcceptSetLike from "../internals/set-method-accept-set-like";
var FORCED = !setMethodAcceptSetLike('union') || !setMethodGetKeysBeforeCloning('union');

// `Set.prototype.union` method
// https://tc39.es/ecma262/#sec-set.prototype.union
$({
  target: 'Set',
  proto: true,
  real: true,
  forced: FORCED
}, {
  union: union
});
const _cjs_default = {};
export default _cjs_default;
