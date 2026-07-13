import $ from "../internals/export";
import aWeakMap from "../internals/a-weak-map";
import { get as _get, has as _has, set as _set } from "../internals/weak-map-helpers";
var get = _get;
var has = _has;
var set = _set;

// `WeakMap.prototype.emplace` method
// https://github.com/tc39/proposal-upsert
$({
  target: 'WeakMap',
  proto: true,
  real: true,
  forced: true
}, {
  emplace: function emplace(key, handler) {
    var map = aWeakMap(this);
    var value, inserted;
    if (has(map, key)) {
      value = get(map, key);
      if ('update' in handler) {
        value = handler.update(value, key, map);
        set(map, key, value);
      }
      return value;
    }
    inserted = handler.insert(key, map);
    set(map, key, inserted);
    return inserted;
  }
});
const _cjs_default = {};
export default _cjs_default;
