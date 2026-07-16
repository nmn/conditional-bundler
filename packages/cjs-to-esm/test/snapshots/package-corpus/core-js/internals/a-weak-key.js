import WeakMapHelpers from "../internals/weak-map-helpers";
var weakmap = new WeakMapHelpers.WeakMap();
var set = WeakMapHelpers.set;
var remove = WeakMapHelpers.remove;
const _cjs_default = function (key) {
  set(weakmap, key, 1);
  remove(weakmap, key);
  return key;
};
export default _cjs_default;
