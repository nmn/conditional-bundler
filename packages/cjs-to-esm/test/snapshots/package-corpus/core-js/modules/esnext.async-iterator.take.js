import $ from "../internals/export";
import call from "../internals/function-call";
import anObject from "../internals/an-object";
import getIteratorDirect from "../internals/get-iterator-direct";
import getMethod from "../internals/get-method";
import notANaN from "../internals/not-a-nan";
import toPositiveInteger from "../internals/to-positive-integer";
import createAsyncIteratorProxy from "../internals/async-iterator-create-proxy";
import createIterResultObject from "../internals/create-iter-result-object";
var AsyncIteratorProxy = createAsyncIteratorProxy(function (Promise) {
  var state = this;
  var iterator = state.iterator;
  var returnMethod;
  if (!state.remaining--) {
    var resultDone = createIterResultObject(undefined, true);
    state.done = true;
    returnMethod = getMethod(iterator, 'return');
    if (returnMethod !== undefined) {
      return Promise.resolve(call(returnMethod, iterator)).then(function (result) {
        anObject(result);
        return resultDone;
      });
    }
    return resultDone;
  }
  return Promise.resolve(call(state.next, iterator)).then(function (step) {
    if (anObject(step).done) {
      state.done = true;
      return createIterResultObject(undefined, true);
    }
    return createIterResultObject(step.value, false);
  }).then(null, function (error) {
    state.done = true;
    throw error;
  });
});

// `AsyncIterator.prototype.take` method
// https://github.com/tc39/proposal-async-iterator-helpers
$({
  target: 'AsyncIterator',
  proto: true,
  real: true,
  forced: true
}, {
  take: function take(limit) {
    anObject(this);
    var remaining = toPositiveInteger(notANaN(+limit));
    return new AsyncIteratorProxy(getIteratorDirect(this), {
      remaining: remaining
    });
  }
});
const _cjs_default = {};
export default _cjs_default;
