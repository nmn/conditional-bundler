import classof from "../internals/classof";
import getMethod from "../internals/get-method";
import isNullOrUndefined from "../internals/is-null-or-undefined";
import Iterators from "../internals/iterators";
import wellKnownSymbol from "../internals/well-known-symbol";
var ITERATOR = wellKnownSymbol('iterator');
const _cjs_default = function (it) {
  if (!isNullOrUndefined(it)) return getMethod(it, ITERATOR) || getMethod(it, '@@iterator') || Iterators[classof(it)];
};
export default _cjs_default;
