import $ from "../internals/export";
import { WeakSet as _WeakSet, add as _add } from "../internals/weak-set-helpers";
import createCollectionFrom from "../internals/collection-from";
// `WeakSet.from` method
// https://tc39.github.io/proposal-setmap-offrom/#sec-weakset.from
$({
  target: 'WeakSet',
  stat: true,
  forced: true
}, {
  from: createCollectionFrom(_WeakSet, _add, false)
});
const _cjs_default = {};
export default _cjs_default;
