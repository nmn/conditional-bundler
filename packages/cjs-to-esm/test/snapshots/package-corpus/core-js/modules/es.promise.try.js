import $ from "../internals/export";
import globalThis from "../internals/global-this";
import apply from "../internals/function-apply";
import slice from "../internals/array-slice";
import { f as _f } from "../internals/new-promise-capability";
import aCallable from "../internals/a-callable";
import perform from "../internals/perform";
var Promise = globalThis.Promise;
var ACCEPT_ARGUMENTS = false;
// Avoiding the use of polyfills of the previous iteration of this proposal
// that does not accept arguments of the callback
var FORCED = !Promise || !Promise['try'] || perform(function () {
  Promise['try'](function (argument) {
    ACCEPT_ARGUMENTS = argument === 8;
  }, 8);
}).error || !ACCEPT_ARGUMENTS;

// `Promise.try` method
// https://tc39.es/ecma262/#sec-promise.try
$({
  target: 'Promise',
  stat: true,
  forced: FORCED
}, {
  'try': function (callbackfn /* , ...args */) {
    var args = arguments.length > 1 ? slice(arguments, 1) : [];
    var promiseCapability = _f(this);
    var result = perform(function () {
      return apply(aCallable(callbackfn), undefined, args);
    });
    (result.error ? promiseCapability.reject : promiseCapability.resolve)(result.value);
    return promiseCapability.promise;
  }
});
const _cjs_default = {};
export default _cjs_default;
