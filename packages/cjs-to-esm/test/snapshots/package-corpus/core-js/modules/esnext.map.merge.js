import $ from "../internals/export";
import aMap from "../internals/a-map";
import iterate from "../internals/iterate";
import { set as _set } from "../internals/map-helpers";
var set = _set;

// `Map.prototype.merge` method
// https://github.com/tc39/proposal-collection-methods
$({
  target: 'Map',
  proto: true,
  real: true,
  arity: 1,
  forced: true
}, {
  // eslint-disable-next-line no-unused-vars -- required for `.length`
  merge: function merge(iterable /* ...iterables */) {
    var map = aMap(this);
    var argumentsLength = arguments.length;
    var i = 0;
    while (i < argumentsLength) {
      iterate(arguments[i++], function (key, value) {
        set(map, key, value);
      }, {
        AS_ENTRIES: true
      });
    }
    return map;
  }
});
const _cjs_default = {};
export default _cjs_default;
