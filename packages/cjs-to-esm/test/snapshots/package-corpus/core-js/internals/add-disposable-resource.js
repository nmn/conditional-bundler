import getBuiltIn from "../internals/get-built-in";
import call from "../internals/function-call";
import uncurryThis from "../internals/function-uncurry-this";
import bind from "../internals/function-bind-context";
import anObject from "../internals/an-object";
import aCallable from "../internals/a-callable";
import isNullOrUndefined from "../internals/is-null-or-undefined";
import getMethod from "../internals/get-method";
import wellKnownSymbol from "../internals/well-known-symbol";
var ASYNC_DISPOSE = wellKnownSymbol('asyncDispose');
var DISPOSE = wellKnownSymbol('dispose');
var push = uncurryThis([].push);

// `GetDisposeMethod` abstract operation
// https://tc39.es/proposal-explicit-resource-management/#sec-getdisposemethod
var getDisposeMethod = function (V, hint) {
  if (hint === 'async-dispose') {
    var method = getMethod(V, ASYNC_DISPOSE);
    if (method !== undefined) return method;
    method = getMethod(V, DISPOSE);
    if (method === undefined) return method;
    return function () {
      var O = this;
      var Promise = getBuiltIn('Promise');
      return new Promise(function (resolve) {
        call(method, O);
        resolve(undefined);
      });
    };
  }
  return getMethod(V, DISPOSE);
};

// `CreateDisposableResource` abstract operation
// https://tc39.es/proposal-explicit-resource-management/#sec-createdisposableresource
var createDisposableResource = function (V, hint, method) {
  if (arguments.length < 3 && !isNullOrUndefined(V)) {
    method = aCallable(getDisposeMethod(anObject(V), hint));
  }
  return method === undefined ? function () {
    return undefined;
  } : bind(method, V);
};

// `AddDisposableResource` abstract operation
// https://tc39.es/proposal-explicit-resource-management/#sec-adddisposableresource
const _cjs_default = function (disposable, V, hint, method) {
  var resource;
  if (arguments.length < 4) {
    // When `V`` is either `null` or `undefined` and hint is `async-dispose`,
    // we record that the resource was evaluated to ensure we will still perform an `Await` when resources are later disposed.
    if (isNullOrUndefined(V) && hint === 'sync-dispose') return;
    resource = createDisposableResource(V, hint);
  } else {
    resource = createDisposableResource(undefined, hint, method);
  }
  push(disposable.stack, resource);
};
export default _cjs_default;
