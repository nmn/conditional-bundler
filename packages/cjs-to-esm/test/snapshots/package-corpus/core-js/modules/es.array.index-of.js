import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this-clause";
import _cjs_import from "../internals/array-includes";
import arrayMethodIsStrict from "../internals/array-method-is-strict";
/* eslint-disable es/no-array-prototype-indexof -- required for testing */

var $indexOf = _cjs_import.indexOf;
var nativeIndexOf = uncurryThis([].indexOf);
var NEGATIVE_ZERO = !!nativeIndexOf && 1 / nativeIndexOf([1], 1, -0) < 0;
var FORCED = NEGATIVE_ZERO || !arrayMethodIsStrict('indexOf');

// `Array.prototype.indexOf` method
// https://tc39.es/ecma262/#sec-array.prototype.indexof
$({
  target: 'Array',
  proto: true,
  forced: FORCED
}, {
  indexOf: function indexOf(searchElement /* , fromIndex = 0 */) {
    var fromIndex = arguments.length > 1 ? arguments[1] : undefined;
    return NEGATIVE_ZERO
    // convert -0 to +0
    ? nativeIndexOf(this, searchElement, fromIndex) || 0 : $indexOf(this, searchElement, fromIndex);
  }
});
const _cjs_default = {};
export default _cjs_default;
