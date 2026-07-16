import $ from "../internals/export";
import WeakSetHelpers from "../internals/weak-set-helpers";
import createCollectionOf from "../internals/collection-of";
// `WeakSet.of` method
// https://tc39.github.io/proposal-setmap-offrom/#sec-weakset.of
$({
  target: 'WeakSet',
  stat: true,
  forced: true
}, {
  of: createCollectionOf(WeakSetHelpers.WeakSet, WeakSetHelpers.add, false)
});
const _cjs_default = {};
export default _cjs_default;
