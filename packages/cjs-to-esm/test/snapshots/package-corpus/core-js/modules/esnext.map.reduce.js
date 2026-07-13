import $ from "../internals/export";
import aCallable from "../internals/a-callable";
import aMap from "../internals/a-map";
import iterate from "../internals/map-iterate";
var $TypeError = TypeError;

// `Map.prototype.reduce` method
// https://github.com/tc39/proposal-collection-methods
$({
  target: 'Map',
  proto: true,
  real: true,
  forced: true
}, {
  reduce: function reduce(callbackfn /* , initialValue */) {
    var map = aMap(this);
    var noInitial = arguments.length < 2;
    var accumulator = noInitial ? undefined : arguments[1];
    aCallable(callbackfn);
    iterate(map, function (value, key) {
      if (noInitial) {
        noInitial = false;
        accumulator = value;
      } else {
        accumulator = callbackfn(accumulator, value, key, map);
      }
    });
    if (noInitial) throw new $TypeError('Reduce of empty map with no initial value');
    return accumulator;
  }
});
const _cjs_default = {};
export default _cjs_default;
