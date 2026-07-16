import uncurryThis from "../internals/function-uncurry-this";
import iterateSimple from "../internals/iterate-simple";
import MapHelpers from "../internals/map-helpers";
var Map = MapHelpers.Map;
var MapPrototype = MapHelpers.proto;
var forEach = uncurryThis(MapPrototype.forEach);
var entries = uncurryThis(MapPrototype.entries);
var next = entries(new Map()).next;
const _cjs_default = function (map, fn, interruptible) {
  return interruptible ? iterateSimple({
    iterator: entries(map),
    next: next
  }, function (entry) {
    return fn(entry[1], entry[0]);
  }) : forEach(map, fn);
};
export default _cjs_default;
