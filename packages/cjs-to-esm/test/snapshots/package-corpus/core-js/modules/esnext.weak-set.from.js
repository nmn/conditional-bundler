import $ from "../internals/export";
import WeakSetHelpers from "../internals/weak-set-helpers";
import createCollectionFrom from "../internals/collection-from";
// `WeakSet.from` method
// https://tc39.github.io/proposal-setmap-offrom/#sec-weakset.from
$({
  target: 'WeakSet',
  stat: true,
  forced: true
}, {
  from: createCollectionFrom(WeakSetHelpers.WeakSet, WeakSetHelpers.add, false)
});
const _cjs_default = {};
export default _cjs_default;
