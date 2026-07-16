import call from "../internals/function-call";
import anObject from "../internals/an-object";
import create from "../internals/object-create";
import getMethod from "../internals/get-method";
import defineBuiltIns from "../internals/define-built-ins";
import InternalStateModule from "../internals/internal-state";
import iteratorClose from "../internals/iterator-close";
import getBuiltIn from "../internals/get-built-in";
import AsyncIteratorPrototype from "../internals/async-iterator-prototype";
import createIterResultObject from "../internals/create-iter-result-object";
var Promise = getBuiltIn('Promise');
var ASYNC_FROM_SYNC_ITERATOR = 'AsyncFromSyncIterator';
var setInternalState = InternalStateModule.set;
var getInternalState = InternalStateModule.getterFor(ASYNC_FROM_SYNC_ITERATOR);
var asyncFromSyncIteratorContinuation = function (result, resolve, reject, syncIterator, closeOnRejection) {
  var done = result.done;
  Promise.resolve(result.value).then(function (value) {
    resolve(createIterResultObject(value, done));
  }, function (error) {
    if (!done && closeOnRejection) {
      try {
        iteratorClose(syncIterator, 'throw', error);
      } catch (error2) {
        error = error2;
      }
    }
    reject(error);
  });
};
var AsyncFromSyncIterator = function AsyncIterator(iteratorRecord) {
  iteratorRecord.type = ASYNC_FROM_SYNC_ITERATOR;
  setInternalState(this, iteratorRecord);
};
AsyncFromSyncIterator.prototype = defineBuiltIns(create(AsyncIteratorPrototype), {
  next: function next() {
    var state = getInternalState(this);
    var hasValue = arguments.length > 0;
    var value = hasValue ? arguments[0] : undefined;
    return new Promise(function (resolve, reject) {
      var result = anObject(hasValue ? call(state.next, state.iterator, value) : call(state.next, state.iterator));
      asyncFromSyncIteratorContinuation(result, resolve, reject, state.iterator, true);
    });
  },
  'return': function () {
    var state = getInternalState(this);
    var iterator = state.iterator;
    var hasValue = arguments.length > 0;
    var value = hasValue ? arguments[0] : undefined;
    return new Promise(function (resolve, reject) {
      var $return = getMethod(iterator, 'return');
      if ($return === undefined) return resolve(createIterResultObject(value, true));
      var result = anObject(hasValue ? call($return, iterator, value) : call($return, iterator));
      asyncFromSyncIteratorContinuation(result, resolve, reject, iterator);
    });
  },
  'throw': function () {
    var state = getInternalState(this);
    var iterator = state.iterator;
    var hasValue = arguments.length > 0;
    var value = hasValue ? arguments[0] : undefined;
    return new Promise(function (resolve, reject) {
      var $throw = getMethod(iterator, 'throw');
      if ($throw === undefined) {
        try {
          iteratorClose(iterator, 'normal');
        } catch (error) {
          return reject(error);
        }
        return reject(new TypeError('The iterator does not provide a throw method'));
      }
      var result = anObject(hasValue ? call($throw, iterator, value) : call($throw, iterator));
      asyncFromSyncIteratorContinuation(result, resolve, reject, iterator, true);
    });
  }
});
const _cjs_default = AsyncFromSyncIterator;
export default _cjs_default;
