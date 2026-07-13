import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this";
import aCallable from "../internals/a-callable";
import requireObjectCoercible from "../internals/require-object-coercible";
import iterate from "../internals/iterate";
import { Map as _Map, has as _has, get as _get, set as _set } from "../internals/map-helpers";
import IS_PURE from "../internals/is-pure";
import fails from "../internals/fails";
var Map = _Map;
var has = _has;
var get = _get;
var set = _set;
var push = uncurryThis([].push);

// https://bugs.webkit.org/show_bug.cgi?id=271524
var DOES_NOT_WORK_WITH_PRIMITIVES = IS_PURE || fails(function () {
  return Map.groupBy('ab', function (it) {
    return it;
  }).get('a').length !== 1;
});

// `Map.groupBy` method
// https://tc39.es/ecma262/#sec-map.groupby
$({
  target: 'Map',
  stat: true,
  forced: IS_PURE || DOES_NOT_WORK_WITH_PRIMITIVES
}, {
  groupBy: function groupBy(items, callbackfn) {
    requireObjectCoercible(items);
    aCallable(callbackfn);
    var map = new Map();
    var k = 0;
    iterate(items, function (value) {
      var key = callbackfn(value, k++);
      if (!has(map, key)) set(map, key, [value]);else push(get(map, key), value);
    });
    return map;
  }
});
const _cjs_default = {};
export default _cjs_default;
