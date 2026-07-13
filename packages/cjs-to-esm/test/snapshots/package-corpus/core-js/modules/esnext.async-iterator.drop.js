import $ from "../internals/export";
import call from "../internals/function-call";
import anObject from "../internals/an-object";
import getIteratorDirect from "../internals/get-iterator-direct";
import notANaN from "../internals/not-a-nan";
import toPositiveInteger from "../internals/to-positive-integer";
import createAsyncIteratorProxy from "../internals/async-iterator-create-proxy";
import createIterResultObject from "../internals/create-iter-result-object";
var AsyncIteratorProxy = createAsyncIteratorProxy(function (Promise) {
  var state = this;
  return new Promise(function (resolve, reject) {
    var doneAndReject = function (error) {
      state.done = true;
      reject(error);
    };
    var loop = function () {
      try {
        Promise.resolve(anObject(call(state.next, state.iterator))).then(function (step) {
          try {
            if (anObject(step).done) {
              state.done = true;
              resolve(createIterResultObject(undefined, true));
            } else if (state.remaining) {
              state.remaining--;
              loop();
            } else resolve(createIterResultObject(step.value, false));
          } catch (err) {
            doneAndReject(err);
          }
        }, doneAndReject);
      } catch (error) {
        doneAndReject(error);
      }
    };
    loop();
  });
});

// `AsyncIterator.prototype.drop` method
// https://github.com/tc39/proposal-async-iterator-helpers
$({
  target: 'AsyncIterator',
  proto: true,
  real: true,
  forced: true
}, {
  drop: function drop(limit) {
    anObject(this);
    var remaining = toPositiveInteger(notANaN(+limit));
    return new AsyncIteratorProxy(getIteratorDirect(this), {
      remaining: remaining
    });
  }
});
const _cjs_default = {};
export default _cjs_default;
