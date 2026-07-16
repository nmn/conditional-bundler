import $ from "../internals/export";
import bind from "../internals/function-bind-context";
import aMap from "../internals/a-map";
import MapHelpers from "../internals/map-helpers";
import iterate from "../internals/map-iterate";
var Map = MapHelpers.Map;
var set = MapHelpers.set;

// `Map.prototype.mapKeys` method
// https://github.com/tc39/proposal-collection-methods
$({
  target: 'Map',
  proto: true,
  real: true,
  forced: true
}, {
  mapKeys: function mapKeys(callbackfn /* , thisArg */) {
    var map = aMap(this);
    var boundFunction = bind(callbackfn, arguments.length > 1 ? arguments[1] : undefined);
    var newMap = new Map();
    iterate(map, function (value, key) {
      set(newMap, boundFunction(value, key, map), value);
    });
    return newMap;
  }
});
const _cjs_default = {};
export default _cjs_default;
