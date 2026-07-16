import $ from "../internals/export";
import MapHelpers from "../internals/map-helpers";
import createCollectionOf from "../internals/collection-of";
// `Map.of` method
// https://tc39.github.io/proposal-setmap-offrom/#sec-map.of
$({
  target: 'Map',
  stat: true,
  forced: true
}, {
  of: createCollectionOf(MapHelpers.Map, MapHelpers.set, true)
});
const _cjs_default = {};
export default _cjs_default;
