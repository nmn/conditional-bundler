import $ from "../internals/export";
import { Set as _Set, add as _add } from "../internals/set-helpers";
import createCollectionOf from "../internals/collection-of";
// `Set.of` method
// https://tc39.github.io/proposal-setmap-offrom/#sec-set.of
$({
  target: 'Set',
  stat: true,
  forced: true
}, {
  of: createCollectionOf(_Set, _add, false)
});
const _cjs_default = {};
export default _cjs_default;
