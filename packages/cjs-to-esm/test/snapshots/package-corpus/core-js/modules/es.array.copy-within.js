import $ from "../internals/export";
import copyWithin from "../internals/array-copy-within";
import addToUnscopables from "../internals/add-to-unscopables";
// `Array.prototype.copyWithin` method
// https://tc39.es/ecma262/#sec-array.prototype.copywithin
$({
  target: 'Array',
  proto: true
}, {
  copyWithin: copyWithin
});

// https://tc39.es/ecma262/#sec-array.prototype-@@unscopables
addToUnscopables('copyWithin');
const _cjs_default = {};
export default _cjs_default;
