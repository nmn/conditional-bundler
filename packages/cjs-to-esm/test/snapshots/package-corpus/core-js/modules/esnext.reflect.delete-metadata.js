import $ from "../internals/export";
import { toKey as _toKey, getMap as _getMap, store as _store } from "../internals/reflect-metadata";
import anObject from "../internals/an-object";
var toMetadataKey = _toKey;
var getOrCreateMetadataMap = _getMap;
var store = _store;

// `Reflect.deleteMetadata` method
// https://github.com/rbuckton/reflect-metadata
$({
  target: 'Reflect',
  stat: true
}, {
  deleteMetadata: function deleteMetadata(metadataKey, target /* , targetKey */) {
    var targetKey = arguments.length < 3 ? undefined : toMetadataKey(arguments[2]);
    var metadataMap = getOrCreateMetadataMap(anObject(target), targetKey, false);
    if (metadataMap === undefined || !metadataMap['delete'](metadataKey)) return false;
    if (metadataMap.size) return true;
    var targetMetadata = store.get(target);
    targetMetadata['delete'](targetKey);
    return !!targetMetadata.size || store['delete'](target);
  }
});
const _cjs_default = {};
export default _cjs_default;
