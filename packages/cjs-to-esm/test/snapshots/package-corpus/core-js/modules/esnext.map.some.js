import $ from "../internals/export";
import bind from "../internals/function-bind-context";
import aMap from "../internals/a-map";
import iterate from "../internals/map-iterate";
// `Map.prototype.some` method
// https://github.com/tc39/proposal-collection-methods
$({
  target: 'Map',
  proto: true,
  real: true,
  forced: true
}, {
  some: function some(callbackfn /* , thisArg */) {
    var map = aMap(this);
    var boundFunction = bind(callbackfn, arguments.length > 1 ? arguments[1] : undefined);
    return iterate(map, function (value, key) {
      if (boundFunction(value, key, map)) return true;
    }, true) === true;
  }
});
const _cjs_default = {};
export default _cjs_default;
