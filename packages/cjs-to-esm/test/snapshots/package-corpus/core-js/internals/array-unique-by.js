import aCallable from "../internals/a-callable";
import isNullOrUndefined from "../internals/is-null-or-undefined";
import lengthOfArrayLike from "../internals/length-of-array-like";
import toObject from "../internals/to-object";
import createProperty from "../internals/create-property";
import { Map as _Map, has as _has, set as _set } from "../internals/map-helpers";
import iterate from "../internals/map-iterate";
var Map = _Map;
var mapHas = _has;
var mapSet = _set;

// `Array.prototype.uniqueBy` method
// https://github.com/tc39/proposal-array-unique
const _cjs_default = function uniqueBy(resolver) {
  var that = toObject(this);
  var length = lengthOfArrayLike(that);
  var result = [];
  var map = new Map();
  var resolverFunction = !isNullOrUndefined(resolver) ? aCallable(resolver) : function (value) {
    return value;
  };
  var index, item, key;
  for (index = 0; index < length; index++) {
    item = that[index];
    key = resolverFunction(item);
    if (!mapHas(map, key)) mapSet(map, key, item);
  }
  index = 0;
  iterate(map, function (value) {
    createProperty(result, index++, value);
  });
  return result;
};
export default _cjs_default;
