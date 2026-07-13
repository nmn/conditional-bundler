import call from "../internals/function-call";
import defineBuiltIn from "../internals/define-built-in";
import getBuiltIn from "../internals/get-built-in";
import getMethod from "../internals/get-method";
import hasOwn from "../internals/has-own-property";
import wellKnownSymbol from "../internals/well-known-symbol";
import AsyncIteratorPrototype from "../internals/async-iterator-prototype";
// https://github.com/tc39/proposal-async-explicit-resource-management

var ASYNC_DISPOSE = wellKnownSymbol('asyncDispose');
var Promise = getBuiltIn('Promise');
if (!hasOwn(AsyncIteratorPrototype, ASYNC_DISPOSE)) {
  defineBuiltIn(AsyncIteratorPrototype, ASYNC_DISPOSE, function () {
    var O = this;
    return new Promise(function (resolve, reject) {
      var $return = getMethod(O, 'return');
      if ($return) {
        Promise.resolve(call($return, O)).then(function () {
          resolve(undefined);
        }, reject);
      } else resolve(undefined);
    });
  });
}
const _cjs_default = {};
export default _cjs_default;
