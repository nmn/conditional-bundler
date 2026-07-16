import call from "../internals/function-call";
import defineBuiltIn from "../internals/define-built-in";
import getMethod from "../internals/get-method";
import hasOwn from "../internals/has-own-property";
import wellKnownSymbol from "../internals/well-known-symbol";
import _cjs_import from "../internals/iterators-core";
// https://github.com/tc39/proposal-explicit-resource-management

var IteratorPrototype = _cjs_import.IteratorPrototype;
var DISPOSE = wellKnownSymbol('dispose');
if (!hasOwn(IteratorPrototype, DISPOSE)) {
  defineBuiltIn(IteratorPrototype, DISPOSE, function () {
    var $return = getMethod(this, 'return');
    if ($return) call($return, this);
  });
}
const _cjs_default = {};
export default _cjs_default;
