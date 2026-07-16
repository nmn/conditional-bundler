import $ from "../internals/export";
import MapHelpers from "../internals/map-helpers";
import createCollectionFrom from "../internals/collection-from";
// `Map.from` method
// https://tc39.github.io/proposal-setmap-offrom/#sec-map.from
$({
  target: 'Map',
  stat: true,
  forced: true
}, {
  from: createCollectionFrom(MapHelpers.Map, MapHelpers.set, true)
});
const _cjs_default = {};
export default _cjs_default;
