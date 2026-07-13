import $ from "../internals/export";
import upsert from "../internals/map-upsert";
// TODO: remove from `core-js@4`

// `WeakMap.prototype.upsert` method (replaced by `WeakMap.prototype.emplace`)
// https://github.com/tc39/proposal-upsert
$({
  target: 'WeakMap',
  proto: true,
  real: true,
  forced: true
}, {
  upsert: upsert
});
const _cjs_default = {};
export default _cjs_default;
