import uncurryThis from "../internals/function-uncurry-this";
// eslint-disable-next-line es/no-map -- safe
var MapPrototype = Map.prototype;
const _cjs_default = {
  // eslint-disable-next-line es/no-map -- safe
  Map: Map,
  set: uncurryThis(MapPrototype.set),
  get: uncurryThis(MapPrototype.get),
  has: uncurryThis(MapPrototype.has),
  remove: uncurryThis(MapPrototype['delete']),
  proto: MapPrototype
};
const _Map = _cjs_default["Map"];
export { _Map as Map };
const _set = _cjs_default["set"];
export { _set as set };
const _get = _cjs_default["get"];
export { _get as get };
const _has = _cjs_default["has"];
export { _has as has };
const _remove = _cjs_default["remove"];
export { _remove as remove };
const _proto = _cjs_default["proto"];
export { _proto as proto };
export default _cjs_default;
