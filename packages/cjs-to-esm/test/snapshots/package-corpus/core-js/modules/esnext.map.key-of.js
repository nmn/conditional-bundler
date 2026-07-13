import $ from "../internals/export";
import aMap from "../internals/a-map";
import iterate from "../internals/map-iterate";
// `Map.prototype.keyOf` method
// https://github.com/tc39/proposal-collection-methods
$({
  target: 'Map',
  proto: true,
  real: true,
  forced: true
}, {
  keyOf: function keyOf(searchElement) {
    var result = iterate(aMap(this), function (value, key) {
      if (value === searchElement) return {
        key: key
      };
    }, true);
    return result && result.key;
  }
});
const _cjs_default = {};
export default _cjs_default;
