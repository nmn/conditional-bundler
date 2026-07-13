import call from "../internals/function-call";
import aCallable from "../internals/a-callable";
import anObject from "../internals/an-object";
import isObject from "../internals/is-object";
import doesNotExceedSafeInteger from "../internals/does-not-exceed-safe-integer";
import getBuiltIn from "../internals/get-built-in";
import createProperty from "../internals/create-property";
import setArrayLength from "../internals/array-set-length";
import getIteratorDirect from "../internals/get-iterator-direct";
import closeAsyncIteration from "../internals/async-iterator-close";
// https://github.com/tc39/proposal-async-iterator-helpers
// https://github.com/tc39/proposal-array-from-async

var createMethod = function (TYPE) {
  var IS_TO_ARRAY = TYPE === 0;
  var IS_FOR_EACH = TYPE === 1;
  var IS_EVERY = TYPE === 2;
  var IS_SOME = TYPE === 3;
  return function (object, fn, target) {
    anObject(object);
    var MAPPING = fn !== undefined;
    if (MAPPING || !IS_TO_ARRAY) aCallable(fn);
    var record = getIteratorDirect(object);
    var Promise = getBuiltIn('Promise');
    var iterator = record.iterator;
    var next = record.next;
    var counter = 0;
    return new Promise(function (resolve, reject) {
      var ifAbruptCloseAsyncIterator = function (error) {
        closeAsyncIteration(iterator, reject, error, reject);
      };
      var loop = function () {
        try {
          try {
            doesNotExceedSafeInteger(counter);
          } catch (error5) {
            return ifAbruptCloseAsyncIterator(error5);
          }
          Promise.resolve(anObject(call(next, iterator))).then(function (step) {
            try {
              if (anObject(step).done) {
                if (IS_TO_ARRAY) {
                  setArrayLength(target, counter);
                  resolve(target);
                } else resolve(IS_SOME ? false : IS_EVERY || undefined);
              } else {
                var value = step.value;
                try {
                  if (MAPPING) {
                    var index = counter++;
                    var result = fn(value, index);
                    var handler = function ($result) {
                      if (IS_FOR_EACH) {
                        loop();
                      } else if (IS_EVERY) {
                        $result ? loop() : closeAsyncIteration(iterator, resolve, false, reject);
                      } else if (IS_TO_ARRAY) {
                        try {
                          createProperty(target, index, $result);
                          loop();
                        } catch (error4) {
                          ifAbruptCloseAsyncIterator(error4);
                        }
                      } else {
                        $result ? closeAsyncIteration(iterator, resolve, IS_SOME || value, reject) : loop();
                      }
                    };
                    if (isObject(result)) Promise.resolve(result).then(handler, ifAbruptCloseAsyncIterator);else handler(result);
                  } else {
                    createProperty(target, counter++, value);
                    loop();
                  }
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
  };
};
const _cjs_default = {
  // `AsyncIterator.prototype.toArray` / `Array.fromAsync` methods
  toArray: createMethod(0),
  // `AsyncIterator.prototype.forEach` method
  forEach: createMethod(1),
  // `AsyncIterator.prototype.every` method
  every: createMethod(2),
  // `AsyncIterator.prototype.some` method
  some: createMethod(3),
  // `AsyncIterator.prototype.find` method
  find: createMethod(4)
};
const _toArray = _cjs_default["toArray"];
export { _toArray as toArray };
const _forEach = _cjs_default["forEach"];
export { _forEach as forEach };
const _every = _cjs_default["every"];
export { _every as every };
const _some = _cjs_default["some"];
export { _some as some };
const _find = _cjs_default["find"];
export { _find as find };
export default _cjs_default;
