import $ from "../internals/export";
import SetHelpers from "../internals/set-helpers";
import createCollectionFrom from "../internals/collection-from";
// `Set.from` method
// https://tc39.github.io/proposal-setmap-offrom/#sec-set.from
$({
  target: 'Set',
  stat: true,
  forced: true
}, {
  from: createCollectionFrom(SetHelpers.Set, SetHelpers.add, false)
});
const _cjs_default = {};
export default _cjs_default;
