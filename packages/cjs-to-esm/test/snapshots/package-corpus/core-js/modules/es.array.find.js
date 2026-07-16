import $ from "../internals/export";
import _cjs_import from "../internals/array-iteration";
import addToUnscopables from "../internals/add-to-unscopables";
var $find = _cjs_import.find;
var FIND = 'find';
var SKIPS_HOLES = true;

// Shouldn't skip holes
// eslint-disable-next-line es/no-array-prototype-find -- testing
if (FIND in []) Array(1)[FIND](function () {
  SKIPS_HOLES = false;
});

// `Array.prototype.find` method
// https://tc39.es/ecma262/#sec-array.prototype.find
$({
  target: 'Array',
  proto: true,
  forced: SKIPS_HOLES
}, {
  find: function find(callbackfn /* , that = undefined */) {
    return $find(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
  }
});

// https://tc39.es/ecma262/#sec-array.prototype-@@unscopables
addToUnscopables(FIND);
const _cjs_default = {};
export default _cjs_default;
