import $ from "../internals/export";
import { has as _has, get as _get, toKey as _toKey } from "../internals/reflect-metadata";
import anObject from "../internals/an-object";
import getPrototypeOf from "../internals/object-get-prototype-of";
// TODO: Remove from `core-js@4`

var ordinaryHasOwnMetadata = _has;
var ordinaryGetOwnMetadata = _get;
var toMetadataKey = _toKey;
var ordinaryGetMetadata = function (MetadataKey, O, P) {
  var hasOwn = ordinaryHasOwnMetadata(MetadataKey, O, P);
  if (hasOwn) return ordinaryGetOwnMetadata(MetadataKey, O, P);
  var parent = getPrototypeOf(O);
  return parent !== null ? ordinaryGetMetadata(MetadataKey, parent, P) : undefined;
};

// `Reflect.getMetadata` method
// https://github.com/rbuckton/reflect-metadata
$({
  target: 'Reflect',
  stat: true
}, {
  getMetadata: function getMetadata(metadataKey, target /* , targetKey */) {
    var targetKey = arguments.length < 3 ? undefined : toMetadataKey(arguments[2]);
    return ordinaryGetMetadata(metadataKey, anObject(target), targetKey);
  }
});
const _cjs_default = {};
export default _cjs_default;
