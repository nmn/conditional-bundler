import $ from "../internals/export";
import arrayMethodIsStrict from "../internals/array-method-is-strict";
import addToUnscopables from "../internals/add-to-unscopables";
import $groupToMap from "../internals/array-group-to-map";
import IS_PURE from "../internals/is-pure";
// TODO: Remove from `core-js@4`

// `Array.prototype.groupByToMap` method
// https://github.com/tc39/proposal-array-grouping
// https://bugs.webkit.org/show_bug.cgi?id=236541
$({
  target: 'Array',
  proto: true,
  name: 'groupToMap',
  forced: IS_PURE || !arrayMethodIsStrict('groupByToMap')
}, {
  groupByToMap: $groupToMap
});
addToUnscopables('groupByToMap');
const _cjs_default = {};
export default _cjs_default;
