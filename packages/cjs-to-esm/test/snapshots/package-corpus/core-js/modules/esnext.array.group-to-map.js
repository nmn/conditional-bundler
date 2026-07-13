import $ from "../internals/export";
import addToUnscopables from "../internals/add-to-unscopables";
import $groupToMap from "../internals/array-group-to-map";
import IS_PURE from "../internals/is-pure";
// `Array.prototype.groupToMap` method
// https://github.com/tc39/proposal-array-grouping
$({
  target: 'Array',
  proto: true,
  forced: IS_PURE
}, {
  groupToMap: $groupToMap
});
addToUnscopables('groupToMap');
const _cjs_default = {};
export default _cjs_default;
