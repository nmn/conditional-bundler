import $ from "../internals/export";
import WeakMapHelpers from "../internals/weak-map-helpers";
import createCollectionOf from "../internals/collection-of";
// `WeakMap.of` method
// https://tc39.github.io/proposal-setmap-offrom/#sec-weakmap.of
$({
  target: 'WeakMap',
  stat: true,
  forced: true
}, {
  of: createCollectionOf(WeakMapHelpers.WeakMap, WeakMapHelpers.set, true)
});
const _cjs_default = {};
export default _cjs_default;
