import $ from "../internals/export";
import call from "../internals/function-call";
import aCallable from "../internals/a-callable";
import anObject from "../internals/an-object";
import isObject from "../internals/is-object";
import getIteratorDirect from "../internals/get-iterator-direct";
import createAsyncIteratorProxy from "../internals/async-iterator-create-proxy";
import createIterResultObject from "../internals/create-iter-result-object";
import getAsyncIteratorFlattenable from "../internals/get-async-iterator-flattenable";
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
    var outerLoop = function () {
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
                  try {
                    state.inner = getAsyncIteratorFlattenable(mapped);
                    innerLoop();
                  } catch (error4) {
                    ifAbruptCloseAsyncIterator(error4);
                  }
                };
                if (isObject(result)) Promise.resolve(result).then(handler, ifAbruptCloseAsyncIterator);else handler(result);
              } catch (error3) {
                ifAbruptCloseAsyncIterator(error3);
              }
            }
          } catch (error2) {
            doneAndReject(error2);
          }
        }, doneAndReject);
      } catch (error) {
        doneAndReject(error);
      }
    };
    var innerLoop = function () {
      var inner = state.inner;
      if (inner) {
        try {
          Promise.resolve(anObject(call(inner.next, inner.iterator))).then(function (result) {
            try {
              if (anObject(result).done) {
                state.inner = null;
                outerLoop();
              } else resolve(createIterResultObject(result.value, false));
            } catch (error1) {
              ifAbruptCloseAsyncIterator(error1);
            }
          }, ifAbruptCloseAsyncIterator);
        } catch (error) {
          ifAbruptCloseAsyncIterator(error);
        }
      } else outerLoop();
    };
    innerLoop();
  });
});

// `AsyncIterator.prototype.flatMap` method
// https://github.com/tc39/proposal-async-iterator-helpers
$({
  target: 'AsyncIterator',
  proto: true,
  real: true,
  forced: true
}, {
  flatMap: function flatMap(mapper) {
    anObject(this);
    aCallable(mapper);
    return new AsyncIteratorProxy(getIteratorDirect(this), {
      mapper: mapper,
      inner: null
    });
  }
});
const _cjs_default = {};
export default _cjs_default;
