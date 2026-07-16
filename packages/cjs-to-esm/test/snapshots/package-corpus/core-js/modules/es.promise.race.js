import $ from "../internals/export";
import call from "../internals/function-call";
import aCallable from "../internals/a-callable";
import newPromiseCapabilityModule from "../internals/new-promise-capability";
import perform from "../internals/perform";
import iterate from "../internals/iterate";
import PROMISE_STATICS_INCORRECT_ITERATION from "../internals/promise-statics-incorrect-iteration";
// `Promise.race` method
// https://tc39.es/ecma262/#sec-promise.race
$({
  target: 'Promise',
  stat: true,
  forced: PROMISE_STATICS_INCORRECT_ITERATION
}, {
  race: function race(iterable) {
    var C = this;
    var capability = newPromiseCapabilityModule.f(C);
    var reject = capability.reject;
    var result = perform(function () {
      var $promiseResolve = aCallable(C.resolve);
      iterate(iterable, function (promise) {
        call($promiseResolve, C, promise).then(capability.resolve, reject);
      });
    });
    if (result.error) reject(result.value);
    return capability.promise;
  }
});
const _cjs_default = {};
export default _cjs_default;
