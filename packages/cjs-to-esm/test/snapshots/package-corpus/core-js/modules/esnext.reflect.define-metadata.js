import $ from "../internals/export";
import { toKey as _toKey, set as _set } from "../internals/reflect-metadata";
import anObject from "../internals/an-object";
// TODO: Remove from `core-js@4`

var toMetadataKey = _toKey;
var ordinaryDefineOwnMetadata = _set;

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
