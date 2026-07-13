import classof from "../internals/classof";
import hasOwn from "../internals/has-own-property";
import isNullOrUndefined from "../internals/is-null-or-undefined";
import wellKnownSymbol from "../internals/well-known-symbol";
import Iterators from "../internals/iterators";
var ITERATOR = wellKnownSymbol('iterator');
var $Object = Object;
const _cjs_default = function (it) {
  if (isNullOrUndefined(it)) return false;
  var O = $Object(it);
  return O[ITERATOR] !== undefined || '@@iterator' in O || hasOwn(Iterators, classof(O));
};
export default _cjs_default;
