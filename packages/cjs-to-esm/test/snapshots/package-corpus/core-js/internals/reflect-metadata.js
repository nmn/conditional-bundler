import "../modules/es.map";
import "../modules/es.weak-map";
import getBuiltIn from "../internals/get-built-in";
import uncurryThis from "../internals/function-uncurry-this";
import shared from "../internals/shared";
// TODO: in core-js@4, move /modules/ dependencies to public entries for better optimization by tools like `preset-env`

var Map = getBuiltIn('Map');
var WeakMap = getBuiltIn('WeakMap');
var push = uncurryThis([].push);
var metadata = shared('metadata');
var store = metadata.store || (metadata.store = new WeakMap());
var getOrCreateMetadataMap = function (target, targetKey, create) {
  var targetMetadata = store.get(target);
  if (!targetMetadata) {
    if (!create) return;
    store.set(target, targetMetadata = new Map());
  }
  var keyMetadata = targetMetadata.get(targetKey);
  if (!keyMetadata) {
    if (!create) return;
    targetMetadata.set(targetKey, keyMetadata = new Map());
  }
  return keyMetadata;
};
var ordinaryHasOwnMetadata = function (MetadataKey, O, P) {
  var metadataMap = getOrCreateMetadataMap(O, P, false);
  return metadataMap === undefined ? false : metadataMap.has(MetadataKey);
};
var ordinaryGetOwnMetadata = function (MetadataKey, O, P) {
  var metadataMap = getOrCreateMetadataMap(O, P, false);
  return metadataMap === undefined ? undefined : metadataMap.get(MetadataKey);
};
var ordinaryDefineOwnMetadata = function (MetadataKey, MetadataValue, O, P) {
  getOrCreateMetadataMap(O, P, true).set(MetadataKey, MetadataValue);
};
var ordinaryOwnMetadataKeys = function (target, targetKey) {
  var metadataMap = getOrCreateMetadataMap(target, targetKey, false);
  var keys = [];
  if (metadataMap) metadataMap.forEach(function (_, key) {
    push(keys, key);
  });
  return keys;
};
var toMetadataKey = function (it) {
  return it === undefined || typeof it == 'symbol' ? it : String(it);
};
const _cjs_default = {
  store: store,
  getMap: getOrCreateMetadataMap,
  has: ordinaryHasOwnMetadata,
  get: ordinaryGetOwnMetadata,
  set: ordinaryDefineOwnMetadata,
  keys: ordinaryOwnMetadataKeys,
  toKey: toMetadataKey
};
const _store = _cjs_default["store"];
export { _store as store };
const _getMap = _cjs_default["getMap"];
export { _getMap as getMap };
const _has = _cjs_default["has"];
export { _has as has };
const _get = _cjs_default["get"];
export { _get as get };
const _set = _cjs_default["set"];
export { _set as set };
const _keys = _cjs_default["keys"];
export { _keys as keys };
const _toKey = _cjs_default["toKey"];
export { _toKey as toKey };
export default _cjs_default;
