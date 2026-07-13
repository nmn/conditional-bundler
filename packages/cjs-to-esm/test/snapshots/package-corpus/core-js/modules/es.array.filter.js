import $ from "../internals/export";
import { filter as _filter } from "../internals/array-iteration";
import arrayMethodHasSpeciesSupport from "../internals/array-method-has-species-support";
var $filter = _filter;
var HAS_SPECIES_SUPPORT = arrayMethodHasSpeciesSupport('filter');

// `Array.prototype.filter` method
// https://tc39.es/ecma262/#sec-array.prototype.filter
// with adding support of @@species
$({
  target: 'Array',
  proto: true,
  forced: !HAS_SPECIES_SUPPORT
}, {
  filter: function filter(callbackfn /* , thisArg */) {
    return $filter(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
  }
});
const _cjs_default = {};
export default _cjs_default;
