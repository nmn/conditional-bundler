import $ from "../internals/export";
import sameValueZero from "../internals/same-value-zero";
import aMap from "../internals/a-map";
import iterate from "../internals/map-iterate";
// `Map.prototype.includes` method
// https://github.com/tc39/proposal-collection-methods
$({
  target: 'Map',
  proto: true,
  real: true,
  forced: true
}, {
  includes: function includes(searchElement) {
    return iterate(aMap(this), function (value) {
      if (sameValueZero(value, searchElement)) return true;
    }, true) === true;
  }
});
const _cjs_default = {};
export default _cjs_default;
