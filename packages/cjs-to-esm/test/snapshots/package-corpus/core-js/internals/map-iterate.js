import uncurryThis from "../internals/function-uncurry-this";
import iterateSimple from "../internals/iterate-simple";
import { Map as _Map, proto as _proto } from "../internals/map-helpers";
var Map = _Map;
var MapPrototype = _proto;
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
