import $ from "../internals/export";
import ReflectMetadataModule from "../internals/reflect-metadata";
import anObject from "../internals/an-object";
var toMetadataKey = ReflectMetadataModule.toKey;
var ordinaryDefineOwnMetadata = ReflectMetadataModule.set;

// `Reflect.metadata` method
// https://github.com/rbuckton/reflect-metadata
$({
  target: 'Reflect',
  stat: true
}, {
  metadata: function metadata(metadataKey, metadataValue) {
    return function decorator(target, key) {
      ordinaryDefineOwnMetadata(metadataKey, metadataValue, anObject(target), toMetadataKey(key));
    };
  }
});
const _cjs_default = {};
export default _cjs_default;
