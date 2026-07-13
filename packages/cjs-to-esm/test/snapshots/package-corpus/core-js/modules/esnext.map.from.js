import $ from "../internals/export";
import { Map as _Map, set as _set } from "../internals/map-helpers";
import createCollectionFrom from "../internals/collection-from";
// `Map.from` method
// https://tc39.github.io/proposal-setmap-offrom/#sec-map.from
$({
  target: 'Map',
  stat: true,
  forced: true
}, {
  from: createCollectionFrom(_Map, _set, true)
});
const _cjs_default = {};
export default _cjs_default;
