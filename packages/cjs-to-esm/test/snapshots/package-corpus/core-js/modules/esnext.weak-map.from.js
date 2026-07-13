import $ from "../internals/export";
import { WeakMap as _WeakMap, set as _set } from "../internals/weak-map-helpers";
import createCollectionFrom from "../internals/collection-from";
// `WeakMap.from` method
// https://tc39.github.io/proposal-setmap-offrom/#sec-weakmap.from
$({
  target: 'WeakMap',
  stat: true,
  forced: true
}, {
  from: createCollectionFrom(_WeakMap, _set, true)
});
const _cjs_default = {};
export default _cjs_default;
