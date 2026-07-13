import $ from "../internals/export";
import upsert from "../internals/map-upsert";
// TODO: remove from `core-js@4`

// `Map.prototype.updateOrInsert` method (replaced by `Map.prototype.emplace`)
// https://github.com/thumbsupep/proposal-upsert
$({
  target: 'Map',
  proto: true,
  real: true,
  name: 'upsert',
  forced: true
}, {
  updateOrInsert: upsert
});
const _cjs_default = {};
export default _cjs_default;
