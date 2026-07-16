import $ from "../internals/export";
import aCallable from "../internals/a-callable";
import MapHelpers from "../internals/map-helpers";
import IS_PURE from "../internals/is-pure";
var get = MapHelpers.get;
var has = MapHelpers.has;
var set = MapHelpers.set;

// `Map.prototype.getOrInsertComputed` method
// https://tc39.es/ecma262/#sec-map.prototype.getorinsertcomputed
$({
  target: 'Map',
  proto: true,
  real: true,
  forced: IS_PURE
}, {
  getOrInsertComputed: function getOrInsertComputed(key, callbackfn) {
    var hasKey = has(this, key);
    aCallable(callbackfn);
    if (hasKey) return get(this, key);
    // CanonicalizeKeyedCollectionKey
    if (key === 0 && 1 / key === -Infinity) key = 0;
    var value = callbackfn(key);
    set(this, key, value);
    return value;
  }
});
const _cjs_default = {};
export default _cjs_default;
