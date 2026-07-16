import bind from "../internals/function-bind-context";
import uncurryThis from "../internals/function-uncurry-this";
import IndexedObject from "../internals/indexed-object";
import toObject from "../internals/to-object";
import lengthOfArrayLike from "../internals/length-of-array-like";
import MapHelpers from "../internals/map-helpers";
var Map = MapHelpers.Map;
var mapGet = MapHelpers.get;
var mapHas = MapHelpers.has;
var mapSet = MapHelpers.set;
var push = uncurryThis([].push);

// `Array.prototype.groupToMap` method
// https://github.com/tc39/proposal-array-grouping
const _cjs_default = function groupToMap(callbackfn /* , thisArg */) {
  var O = toObject(this);
  var self = IndexedObject(O);
  var boundFunction = bind(callbackfn, arguments.length > 1 ? arguments[1] : undefined);
  var map = new Map();
  var length = lengthOfArrayLike(self);
  var index = 0;
  var key, value;
  for (; length > index; index++) {
    value = self[index];
    key = boundFunction(value, index, O);
    if (mapHas(map, key)) push(mapGet(map, key), value);else mapSet(map, key, [value]);
  }
  return map;
};
export default _cjs_default;
