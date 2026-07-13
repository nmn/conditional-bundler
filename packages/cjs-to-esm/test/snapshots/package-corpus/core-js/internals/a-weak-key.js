import { WeakMap as _WeakMap, set as _set, remove as _remove } from "../internals/weak-map-helpers";
var weakmap = new _WeakMap();
var set = _set;
var remove = _remove;
const _cjs_default = function (key) {
  set(weakmap, key, 1);
  remove(weakmap, key);
  return key;
};
export default _cjs_default;
