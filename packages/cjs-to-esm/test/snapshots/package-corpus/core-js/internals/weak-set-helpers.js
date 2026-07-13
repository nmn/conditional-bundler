import uncurryThis from "../internals/function-uncurry-this";
// eslint-disable-next-line es/no-weak-set -- safe
var WeakSetPrototype = WeakSet.prototype;
const _cjs_default = {
  // eslint-disable-next-line es/no-weak-set -- safe
  WeakSet: WeakSet,
  add: uncurryThis(WeakSetPrototype.add),
  has: uncurryThis(WeakSetPrototype.has),
  remove: uncurryThis(WeakSetPrototype['delete'])
};
const _WeakSet = _cjs_default["WeakSet"];
export { _WeakSet as WeakSet };
const _add = _cjs_default["add"];
export { _add as add };
const _has = _cjs_default["has"];
export { _has as has };
const _remove = _cjs_default["remove"];
export { _remove as remove };
export default _cjs_default;
