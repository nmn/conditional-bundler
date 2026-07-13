import $ from "../internals/export";
import { get as _get, has as _has, set as _set } from "../internals/map-helpers";
import IS_PURE from "../internals/is-pure";
var get = _get;
var has = _has;
var set = _set;

// `Map.prototype.getOrInsert` method
// https://tc39.es/ecma262/#sec-map.prototype.getorinsert
$({
  target: 'Map',
  proto: true,
  real: true,
  forced: IS_PURE
}, {
  getOrInsert: function getOrInsert(key, value) {
    if (has(this, key)) return get(this, key);
    set(this, key, value);
    return value;
  }
});
const _cjs_default = {};
export default _cjs_default;
