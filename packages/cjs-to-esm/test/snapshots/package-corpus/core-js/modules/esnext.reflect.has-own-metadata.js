import $ from "../internals/export";
import ReflectMetadataModule from "../internals/reflect-metadata";
import anObject from "../internals/an-object";
// TODO: Remove from `core-js@4`

var ordinaryHasOwnMetadata = ReflectMetadataModule.has;
var toMetadataKey = ReflectMetadataModule.toKey;

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
