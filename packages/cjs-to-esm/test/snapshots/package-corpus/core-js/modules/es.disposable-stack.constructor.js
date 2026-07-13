import $ from "../internals/export";
import DESCRIPTORS from "../internals/descriptors";
import getBuiltIn from "../internals/get-built-in";
import aCallable from "../internals/a-callable";
import anInstance from "../internals/an-instance";
import defineBuiltIn from "../internals/define-built-in";
import defineBuiltIns from "../internals/define-built-ins";
import defineBuiltInAccessor from "../internals/define-built-in-accessor";
import wellKnownSymbol from "../internals/well-known-symbol";
import { set as _set, getterFor as _getterFor } from "../internals/internal-state";
import addDisposableResource from "../internals/add-disposable-resource";
// https://github.com/tc39/proposal-explicit-resource-management

var SuppressedError = getBuiltIn('SuppressedError');
var $ReferenceError = ReferenceError;
var DISPOSE = wellKnownSymbol('dispose');
var TO_STRING_TAG = wellKnownSymbol('toStringTag');
var DISPOSABLE_STACK = 'DisposableStack';
var setInternalState = _set;
var getDisposableStackInternalState = _getterFor(DISPOSABLE_STACK);
var HINT = 'sync-dispose';
var DISPOSED = 'disposed';
var PENDING = 'pending';
var getPendingDisposableStackInternalState = function (stack) {
  var internalState = getDisposableStackInternalState(stack);
  if (internalState.state === DISPOSED) throw new $ReferenceError(DISPOSABLE_STACK + ' already disposed');
  return internalState;
};
var $DisposableStack = function DisposableStack() {
  setInternalState(anInstance(this, DisposableStackPrototype), {
    type: DISPOSABLE_STACK,
    state: PENDING,
    stack: []
  });
  if (!DESCRIPTORS) this.disposed = false;
};
var DisposableStackPrototype = $DisposableStack.prototype;
defineBuiltIns(DisposableStackPrototype, {
  dispose: function dispose() {
    var internalState = getDisposableStackInternalState(this);
    if (internalState.state === DISPOSED) return;
    internalState.state = DISPOSED;
    if (!DESCRIPTORS) this.disposed = true;
    var stack = internalState.stack;
    var i = stack.length;
    var thrown = false;
    var suppressed;
    while (i) {
      var disposeMethod = stack[--i];
      stack[i] = null;
      try {
        disposeMethod();
      } catch (errorResult) {
        if (thrown) {
          suppressed = new SuppressedError(errorResult, suppressed);
        } else {
          thrown = true;
          suppressed = errorResult;
        }
      }
    }
    internalState.stack = null;
    if (thrown) throw suppressed;
  },
  use: function use(value) {
    addDisposableResource(getPendingDisposableStackInternalState(this), value, HINT);
    return value;
  },
  adopt: function adopt(value, onDispose) {
    var internalState = getPendingDisposableStackInternalState(this);
    aCallable(onDispose);
    addDisposableResource(internalState, undefined, HINT, function () {
      onDispose(value);
    });
    return value;
  },
  defer: function defer(onDispose) {
    var internalState = getPendingDisposableStackInternalState(this);
    aCallable(onDispose);
    addDisposableResource(internalState, undefined, HINT, onDispose);
  },
  move: function move() {
    var internalState = getPendingDisposableStackInternalState(this);
    var newDisposableStack = new $DisposableStack();
    getDisposableStackInternalState(newDisposableStack).stack = internalState.stack;
    internalState.stack = [];
    internalState.state = DISPOSED;
    if (!DESCRIPTORS) this.disposed = true;
    return newDisposableStack;
  }
});
if (DESCRIPTORS) defineBuiltInAccessor(DisposableStackPrototype, 'disposed', {
  configurable: true,
  get: function disposed() {
    return getDisposableStackInternalState(this).state === DISPOSED;
  }
});
defineBuiltIn(DisposableStackPrototype, DISPOSE, DisposableStackPrototype.dispose, {
  name: 'dispose'
});
defineBuiltIn(DisposableStackPrototype, TO_STRING_TAG, DISPOSABLE_STACK, {
  nonWritable: true
});
$({
  global: true,
  constructor: true
}, {
  DisposableStack: $DisposableStack
});
const _cjs_default = {};
export default _cjs_default;
