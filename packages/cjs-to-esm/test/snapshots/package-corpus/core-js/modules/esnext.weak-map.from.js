import $ from "../internals/export";
import WeakMapHelpers from "../internals/weak-map-helpers";
import createCollectionFrom from "../internals/collection-from";
// `WeakMap.from` method
// https://tc39.github.io/proposal-setmap-offrom/#sec-weakmap.from
$({
  target: 'WeakMap',
  stat: true,
  forced: true
}, {
  from: createCollectionFrom(WeakMapHelpers.WeakMap, WeakMapHelpers.set, true)
});
const _cjs_default = {};
export default _cjs_default;
