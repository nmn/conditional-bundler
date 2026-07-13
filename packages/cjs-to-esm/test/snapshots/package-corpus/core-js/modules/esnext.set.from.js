import $ from "../internals/export";
import { Set as _Set, add as _add } from "../internals/set-helpers";
import createCollectionFrom from "../internals/collection-from";
// `Set.from` method
// https://tc39.github.io/proposal-setmap-offrom/#sec-set.from
$({
  target: 'Set',
  stat: true,
  forced: true
}, {
  from: createCollectionFrom(_Set, _add, false)
});
const _cjs_default = {};
export default _cjs_default;
