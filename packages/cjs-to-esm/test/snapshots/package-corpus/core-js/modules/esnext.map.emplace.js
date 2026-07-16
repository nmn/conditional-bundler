import $ from "../internals/export";
import aMap from "../internals/a-map";
import MapHelpers from "../internals/map-helpers";
var get = MapHelpers.get;
var has = MapHelpers.has;
var set = MapHelpers.set;

// `Map.prototype.emplace` method
// https://github.com/tc39/proposal-upsert
$({
  target: 'Map',
  proto: true,
  real: true,
  forced: true
}, {
  emplace: function emplace(key, handler) {
    var map = aMap(this);
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
