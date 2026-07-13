import $ from "../internals/export";
import bind from "../internals/function-bind-context";
import aMap from "../internals/a-map";
import iterate from "../internals/map-iterate";
// `Map.prototype.every` method
// https://github.com/tc39/proposal-collection-methods
$({
  target: 'Map',
  proto: true,
  real: true,
  forced: true
}, {
  every: function every(callbackfn /* , thisArg */) {
    var map = aMap(this);
    var boundFunction = bind(callbackfn, arguments.length > 1 ? arguments[1] : undefined);
    return iterate(map, function (value, key) {
      if (!boundFunction(value, key, map)) return false;
    }, true) !== false;
  }
});
const _cjs_default = {};
export default _cjs_default;
