import uncurryThis from "../internals/function-uncurry-this";
// eslint-disable-next-line es/no-set -- safe
var SetPrototype = Set.prototype;
const _cjs_default = {
  // eslint-disable-next-line es/no-set -- safe
  Set: Set,
  add: uncurryThis(SetPrototype.add),
  has: uncurryThis(SetPrototype.has),
  remove: uncurryThis(SetPrototype['delete']),
  proto: SetPrototype
};
const _Set = _cjs_default["Set"];
export { _Set as Set };
const _add = _cjs_default["add"];
export { _add as add };
const _has = _cjs_default["has"];
export { _has as has };
const _remove = _cjs_default["remove"];
export { _remove as remove };
const _proto = _cjs_default["proto"];
export { _proto as proto };
export default _cjs_default;
