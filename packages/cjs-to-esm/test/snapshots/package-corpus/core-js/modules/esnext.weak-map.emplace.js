import $ from "../internals/export";
import aWeakMap from "../internals/a-weak-map";
import WeakMapHelpers from "../internals/weak-map-helpers";
var get = WeakMapHelpers.get;
var has = WeakMapHelpers.has;
var set = WeakMapHelpers.set;

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
