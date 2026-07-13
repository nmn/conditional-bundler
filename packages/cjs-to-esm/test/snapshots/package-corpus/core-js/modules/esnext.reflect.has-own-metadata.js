import $ from "../internals/export";
import { has as _has, toKey as _toKey } from "../internals/reflect-metadata";
import anObject from "../internals/an-object";
// TODO: Remove from `core-js@4`

var ordinaryHasOwnMetadata = _has;
var toMetadataKey = _toKey;

// `Reflect.hasOwnMetadata` method
// https://github.com/rbuckton/reflect-metadata
$({
  target: 'Reflect',
  stat: true
}, {
  hasOwnMetadata: function hasOwnMetadata(metadataKey, target /* , targetKey */) {
    var targetKey = arguments.length < 3 ? undefined : toMetadataKey(arguments[2]);
    return ordinaryHasOwnMetadata(metadataKey, anObject(target), targetKey);
  }
});
const _cjs_default = {};
export default _cjs_default;
