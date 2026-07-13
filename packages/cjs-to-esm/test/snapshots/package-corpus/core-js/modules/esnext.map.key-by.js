import $ from "../internals/export";
import call from "../internals/function-call";
import iterate from "../internals/iterate";
import isCallable from "../internals/is-callable";
import aCallable from "../internals/a-callable";
import { Map as _Map } from "../internals/map-helpers";
var Map = _Map;

// `Map.keyBy` method
// https://github.com/tc39/proposal-collection-methods
$({
  target: 'Map',
  stat: true,
  forced: true
}, {
  keyBy: function keyBy(iterable, keyDerivative) {
    var C = isCallable(this) ? this : Map;
    var newMap = new C();
    aCallable(keyDerivative);
    var setter = aCallable(newMap.set);
    iterate(iterable, function (element) {
      call(setter, newMap, keyDerivative(element), element);
    });
    return newMap;
  }
});
const _cjs_default = {};
export default _cjs_default;
