import call from "../internals/function-call";
import aCallable from "../internals/a-callable";
import anObject from "../internals/an-object";
import isObject from "../internals/is-object";
import getIteratorDirect from "../internals/get-iterator-direct";
import createAsyncIteratorProxy from "../internals/async-iterator-create-proxy";
import createIterResultObject from "../internals/create-iter-result-object";
import closeAsyncIteration from "../internals/async-iterator-close";
var AsyncIteratorProxy = createAsyncIteratorProxy(function (Promise) {
  var state = this;
  var iterator = state.iterator;
  var mapper = state.mapper;
  return new Promise(function (resolve, reject) {
    var doneAndReject = function (error) {
      state.done = true;
      reject(error);
    };
    var ifAbruptCloseAsyncIterator = function (error) {
      closeAsyncIteration(iterator, doneAndReject, error, doneAndReject);
    };
    try {
      Promise.resolve(anObject(call(state.next, iterator))).then(function (step) {
        try {
          if (anObject(step).done) {
            state.done = true;
            resolve(createIterResultObject(undefined, true));
          } else {
            var value = step.value;
            try {
              var result = mapper(value, state.counter++);
              var handler = function (mapped) {
                resolve(createIterResultObject(mapped, false));
              };
              if (isObject(result)) Promise.resolve(result).then(handler, ifAbruptCloseAsyncIterator);else handler(result);
            } catch (error2) {
              ifAbruptCloseAsyncIterator(error2);
            }
          }
        } catch (error) {
          doneAndReject(error);
        }
      }, doneAndReject);
    } catch (error) {
      doneAndReject(error);
    }
  });
});

// `AsyncIterator.prototype.map` method
// https://github.com/tc39/proposal-async-iterator-helpers
const _cjs_default = function map(mapper) {
  anObject(this);
  aCallable(mapper);
  return new AsyncIteratorProxy(getIteratorDirect(this), {
    mapper: mapper
  });
};
export default _cjs_default;
