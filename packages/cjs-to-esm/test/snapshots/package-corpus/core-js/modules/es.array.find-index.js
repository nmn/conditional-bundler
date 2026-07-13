import $ from "../internals/export";
import { findIndex as _findIndex } from "../internals/array-iteration";
import addToUnscopables from "../internals/add-to-unscopables";
var $findIndex = _findIndex;
var FIND_INDEX = 'findIndex';
var SKIPS_HOLES = true;

// Shouldn't skip holes
// eslint-disable-next-line es/no-array-prototype-findindex -- testing
if (FIND_INDEX in []) Array(1)[FIND_INDEX](function () {
  SKIPS_HOLES = false;
});

// `Array.prototype.findIndex` method
// https://tc39.es/ecma262/#sec-array.prototype.findindex
$({
  target: 'Array',
  proto: true,
  forced: SKIPS_HOLES
}, {
  findIndex: function findIndex(callbackfn /* , that = undefined */) {
    return $findIndex(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
  }
});

// https://tc39.es/ecma262/#sec-array.prototype-@@unscopables
addToUnscopables(FIND_INDEX);
const _cjs_default = {};
export default _cjs_default;
