import $ from "../internals/export";
import { get as _get, toKey as _toKey } from "../internals/reflect-metadata";
import anObject from "../internals/an-object";
// TODO: Remove from `core-js@4`

var ordinaryGetOwnMetadata = _get;
var toMetadataKey = _toKey;

// `Reflect.getOwnMetadata` method
// https://github.com/rbuckton/reflect-metadata
$({
  target: 'Reflect',
  stat: true
}, {
  getOwnMetadata: function getOwnMetadata(metadataKey, target /* , targetKey */) {
    var targetKey = arguments.length < 3 ? undefined : toMetadataKey(arguments[2]);
    return ordinaryGetOwnMetadata(metadataKey, anObject(target), targetKey);
  }
});
const _cjs_default = {};
export default _cjs_default;
