import $ from "../internals/export";
import SetHelpers from "../internals/set-helpers";
import createCollectionOf from "../internals/collection-of";
// `Set.of` method
// https://tc39.github.io/proposal-setmap-offrom/#sec-set.of
$({
  target: 'Set',
  stat: true,
  forced: true
}, {
  of: createCollectionOf(SetHelpers.Set, SetHelpers.add, false)
});
const _cjs_default = {};
export default _cjs_default;
