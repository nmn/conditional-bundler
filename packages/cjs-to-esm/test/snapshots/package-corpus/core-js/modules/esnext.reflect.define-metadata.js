import $ from "../internals/export";
import ReflectMetadataModule from "../internals/reflect-metadata";
import anObject from "../internals/an-object";
// TODO: Remove from `core-js@4`

var toMetadataKey = ReflectMetadataModule.toKey;
var ordinaryDefineOwnMetadata = ReflectMetadataModule.set;

// `Reflect.defineMetadata` method
// https://github.com/rbuckton/reflect-metadata
$({
  target: 'Reflect',
  stat: true
}, {
  defineMetadata: function defineMetadata(metadataKey, metadataValue, target /* , targetKey */) {
    var targetKey = arguments.length < 4 ? undefined : toMetadataKey(arguments[3]);
    ordinaryDefineOwnMetadata(metadataKey, metadataValue, anObject(target), targetKey);
  }
});
const _cjs_default = {};
export default _cjs_default;
