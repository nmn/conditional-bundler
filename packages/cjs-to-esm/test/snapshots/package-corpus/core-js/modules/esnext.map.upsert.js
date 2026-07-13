import $ from "../internals/export";
import upsert from "../internals/map-upsert";
// TODO: remove from `core-js@4`

// `Map.prototype.upsert` method (replaced by `Map.prototype.emplace`)
// https://github.com/thumbsupep/proposal-upsert
$({
  target: 'Map',
  proto: true,
  real: true,
  forced: true
}, {
  upsert: upsert
});
const _cjs_default = {};
export default _cjs_default;
