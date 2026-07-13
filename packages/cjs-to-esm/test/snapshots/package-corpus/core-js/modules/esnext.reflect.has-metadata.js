import $ from "../internals/export";
import { has as _has, toKey as _toKey } from "../internals/reflect-metadata";
import anObject from "../internals/an-object";
import getPrototypeOf from "../internals/object-get-prototype-of";
// TODO: Remove from `core-js@4`

var ordinaryHasOwnMetadata = _has;
var toMetadataKey = _toKey;
var ordinaryHasMetadata = function (MetadataKey, O, P) {
  var hasOwn = ordinaryHasOwnMetadata(MetadataKey, O, P);
  if (hasOwn) return true;
  var parent = getPrototypeOf(O);
  return parent !== null ? ordinaryHasMetadata(MetadataKey, parent, P) : false;
};

// `Reflect.hasMetadata` method
// https://github.com/rbuckton/reflect-metadata
$({
  target: 'Reflect',
  stat: true
}, {
  hasMetadata: function hasMetadata(metadataKey, target /* , targetKey */) {
    var targetKey = arguments.length < 3 ? undefined : toMetadataKey(arguments[2]);
    return ordinaryHasMetadata(metadataKey, anObject(target), targetKey);
  }
});
const _cjs_default = {};
export default _cjs_default;
