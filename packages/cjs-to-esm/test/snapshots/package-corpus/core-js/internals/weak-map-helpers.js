import uncurryThis from "../internals/function-uncurry-this";
// eslint-disable-next-line es/no-weak-map -- safe
var WeakMapPrototype = WeakMap.prototype;
const _cjs_default = {
  // eslint-disable-next-line es/no-weak-map -- safe
  WeakMap: WeakMap,
  set: uncurryThis(WeakMapPrototype.set),
  get: uncurryThis(WeakMapPrototype.get),
  has: uncurryThis(WeakMapPrototype.has),
  remove: uncurryThis(WeakMapPrototype['delete'])
};
const _WeakMap = _cjs_default["WeakMap"];
export { _WeakMap as WeakMap };
const _set = _cjs_default["set"];
export { _set as set };
const _get = _cjs_default["get"];
export { _get as get };
const _has = _cjs_default["has"];
export { _has as has };
const _remove = _cjs_default["remove"];
export { _remove as remove };
export default _cjs_default;
