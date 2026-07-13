import $ from "../internals/export";
import bind from "../internals/function-bind-context";
import aMap from "../internals/a-map";
import { Map as _Map, set as _set } from "../internals/map-helpers";
import iterate from "../internals/map-iterate";
var Map = _Map;
var set = _set;

// `Map.prototype.mapValues` method
// https://github.com/tc39/proposal-collection-methods
$({
  target: 'Map',
  proto: true,
  real: true,
  forced: true
}, {
  mapValues: function mapValues(callbackfn /* , thisArg */) {
    var map = aMap(this);
    var boundFunction = bind(callbackfn, arguments.length > 1 ? arguments[1] : undefined);
    var newMap = new Map();
    iterate(map, function (value, key) {
      set(newMap, key, boundFunction(value, key, map));
    });
    return newMap;
  }
});
const _cjs_default = {};
export default _cjs_default;
