import $ from "../internals/export";
import addToUnscopables from "../internals/add-to-unscopables";
import uniqueBy from "../internals/array-unique-by";
// `Array.prototype.uniqueBy` method
// https://github.com/tc39/proposal-array-unique
$({
  target: 'Array',
  proto: true,
  forced: true
}, {
  uniqueBy: uniqueBy
});
addToUnscopables('uniqueBy');
const _cjs_default = {};
export default _cjs_default;
