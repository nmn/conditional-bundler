import wellKnownSymbol from "../internals/well-known-symbol";
import Iterators from "../internals/iterators";
var ITERATOR = wellKnownSymbol('iterator');
var ArrayPrototype = Array.prototype;

// check on default Array iterator
const _cjs_default = function (it) {
  return it !== undefined && (Iterators.Array === it || ArrayPrototype[ITERATOR] === it);
};
export default _cjs_default;
