import call from "../internals/function-call";
import perform from "../internals/perform";
import anObject from "../internals/an-object";
import create from "../internals/object-create";
import createNonEnumerableProperty from "../internals/create-non-enumerable-property";
import defineBuiltIns from "../internals/define-built-ins";
import wellKnownSymbol from "../internals/well-known-symbol";
import { set as _set, getterFor as _getterFor } from "../internals/internal-state";
import getBuiltIn from "../internals/get-built-in";
import getMethod from "../internals/get-method";
import AsyncIteratorPrototype from "../internals/async-iterator-prototype";
import createIterResultObject from "../internals/create-iter-result-object";
var Promise = getBuiltIn('Promise');
var TO_STRING_TAG = wellKnownSymbol('toStringTag');
var ASYNC_ITERATOR_HELPER = 'AsyncIteratorHelper';
var WRAP_FOR_VALID_ASYNC_ITERATOR = 'WrapForValidAsyncIterator';
var setInternalState = _set;
var createAsyncIteratorProxyPrototype = function (IS_ITERATOR) {
  var IS_GENERATOR = !IS_ITERATOR;
  var getInternalState = _getterFor(IS_ITERATOR ? WRAP_FOR_VALID_ASYNC_ITERATOR : ASYNC_ITERATOR_HELPER);
  var getStateOrEarlyExit = function (that) {
    var stateCompletion = perform(function () {
      return getInternalState(that);
    });
    var stateError = stateCompletion.error;
    var state = stateCompletion.value;
    if (stateError || IS_GENERATOR && state.done) {
      return {
        exit: true,
        value: stateError ? Promise.reject(state) : Promise.resolve(createIterResultObject(undefined, true))
      };
    }
    return {
      exit: false,
      value: state
    };
  };
  return defineBuiltIns(create(AsyncIteratorPrototype), {
    next: function next() {
      var stateCompletion = getStateOrEarlyExit(this);
      var state = stateCompletion.value;
      if (stateCompletion.exit) return state;
      var handlerCompletion = perform(function () {
        return anObject(state.nextHandler(Promise));
      });
      var handlerError = handlerCompletion.error;
      var value = handlerCompletion.value;
      if (handlerError) state.done = true;
      return handlerError ? Promise.reject(value) : Promise.resolve(value);
    },
    'return': function () {
      var stateCompletion = getStateOrEarlyExit(this);
      var state = stateCompletion.value;
      if (stateCompletion.exit) return state;
      state.done = true;
      var iterator = state.iterator;
      var inner = state.inner;
      var returnMethod, result;
      var closeOuterIterator = function () {
        var completion = perform(function () {
          return getMethod(iterator, 'return');
        });
        returnMethod = result = completion.value;
        if (completion.error) return Promise.reject(result);
        if (returnMethod === undefined) return Promise.resolve(createIterResultObject(undefined, true));
        completion = perform(function () {
          return call(returnMethod, iterator);
        });
        result = completion.value;
        if (completion.error) return Promise.reject(result);
        return IS_ITERATOR ? Promise.resolve(result) : Promise.resolve(result).then(function (resolved) {
          anObject(resolved);
          return createIterResultObject(undefined, true);
        });
      };
      var closeAndReject = function (error) {
        return closeOuterIterator().then(function () {
          throw error;
        }, function () {
          throw error;
        });
      };
      if (inner) {
        var innerIterator = inner.iterator;
        var innerReturn;
        var completion = perform(function () {
          innerReturn = getMethod(innerIterator, 'return');
          if (innerReturn) return call(innerReturn, innerIterator);
        });
        if (completion.error) return closeAndReject(completion.value);
        if (innerReturn) {
          return Promise.resolve(completion.value).then(function (innerResult) {
            try {
              anObject(innerResult);
            } catch (error) {
              return closeAndReject(error);
            }
            return closeOuterIterator();
          }, closeAndReject);
        }
      }
      return closeOuterIterator();
    }
  });
};
var WrapForValidAsyncIteratorPrototype = createAsyncIteratorProxyPrototype(true);
var AsyncIteratorHelperPrototype = createAsyncIteratorProxyPrototype(false);
createNonEnumerableProperty(AsyncIteratorHelperPrototype, TO_STRING_TAG, 'Async Iterator Helper');
const _cjs_default = function (nextHandler, IS_ITERATOR) {
  var AsyncIteratorProxy = function AsyncIterator(record, state) {
    if (state) {
      state.iterator = record.iterator;
      state.next = record.next;
    } else state = record;
    state.type = IS_ITERATOR ? WRAP_FOR_VALID_ASYNC_ITERATOR : ASYNC_ITERATOR_HELPER;
    state.nextHandler = nextHandler;
    state.counter = 0;
    state.done = false;
    setInternalState(this, state);
  };
  AsyncIteratorProxy.prototype = IS_ITERATOR ? WrapForValidAsyncIteratorPrototype : AsyncIteratorHelperPrototype;
  return AsyncIteratorProxy;
};
export default _cjs_default;
