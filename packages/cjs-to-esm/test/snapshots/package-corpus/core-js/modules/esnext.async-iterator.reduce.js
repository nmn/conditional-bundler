import $ from "../internals/export";
import call from "../internals/function-call";
import aCallable from "../internals/a-callable";
import anObject from "../internals/an-object";
import isObject from "../internals/is-object";
import getBuiltIn from "../internals/get-built-in";
import getIteratorDirect from "../internals/get-iterator-direct";
import closeAsyncIteration from "../internals/async-iterator-close";
var Promise = getBuiltIn('Promise');
var $TypeError = TypeError;

// `AsyncIterator.prototype.reduce` method
// https://github.com/tc39/proposal-async-iterator-helpers
$({
  target: 'AsyncIterator',
  proto: true,
  real: true,
  forced: true
}, {
  reduce: function reduce(reducer /* , initialValue */) {
    anObject(this);
    aCallable(reducer);
    var record = getIteratorDirect(this);
    var iterator = record.iterator;
    var next = record.next;
    var noInitial = arguments.length < 2;
    var accumulator = noInitial ? undefined : arguments[1];
    var counter = 0;
    return new Promise(function (resolve, reject) {
      var ifAbruptCloseAsyncIterator = function (error) {
        closeAsyncIteration(iterator, reject, error, reject);
      };
      var loop = function () {
        try {
          Promise.resolve(anObject(call(next, iterator))).then(function (step) {
            try {
              if (anObject(step).done) {
                noInitial ? reject(new $TypeError('Reduce of empty iterator with no initial value')) : resolve(accumulator);
              } else {
                var value = step.value;
                if (noInitial) {
                  noInitial = false;
                  accumulator = value;
                  counter++;
                  loop();
                } else try {
                  var result = reducer(accumulator, value, counter++);
                  var handler = function ($result) {
                    accumulator = $result;
                    loop();
                  };
                  if (isObject(result)) Promise.resolve(result).then(handler, ifAbruptCloseAsyncIterator);else handler(result);
                } catch (error3) {
                  ifAbruptCloseAsyncIterator(error3);
                }
              }
            } catch (error2) {
              reject(error2);
            }
          }, reject);
        } catch (error) {
          reject(error);
        }
      };
      loop();
    });
  }
});
const _cjs_default = {};
export default _cjs_default;
