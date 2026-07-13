import $ from "../internals/export";
import aCallable from "../internals/a-callable";
import aMap from "../internals/a-map";
import { get as _get, has as _has, set as _set } from "../internals/map-helpers";
var $TypeError = TypeError;
var get = _get;
var has = _has;
var set = _set;

// `Map.prototype.update` method
// https://github.com/tc39/proposal-collection-methods
$({
  target: 'Map',
  proto: true,
  real: true,
  forced: true
}, {
  update: function update(key, callback /* , thunk */) {
    var map = aMap(this);
    var length = arguments.length;
    aCallable(callback);
    var isPresentInMap = has(map, key);
    if (!isPresentInMap && length < 3) {
      throw new $TypeError('Updating absent value');
    }
    var value = isPresentInMap ? get(map, key) : aCallable(length > 2 ? arguments[2] : undefined)(key, map);
    set(map, key, callback(value, key, map));
    return map;
  }
});
const _cjs_default = {};
export default _cjs_default;
