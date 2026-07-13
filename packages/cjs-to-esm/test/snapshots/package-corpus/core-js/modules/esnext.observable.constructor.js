import $ from "../internals/export";
import call from "../internals/function-call";
import DESCRIPTORS from "../internals/descriptors";
import setSpecies from "../internals/set-species";
import aCallable from "../internals/a-callable";
import anObject from "../internals/an-object";
import anInstance from "../internals/an-instance";
import isCallable from "../internals/is-callable";
import isNullOrUndefined from "../internals/is-null-or-undefined";
import isObject from "../internals/is-object";
import getMethod from "../internals/get-method";
import defineBuiltIn from "../internals/define-built-in";
import defineBuiltIns from "../internals/define-built-ins";
import defineBuiltInAccessor from "../internals/define-built-in-accessor";
import hostReportErrors from "../internals/host-report-errors";
import wellKnownSymbol from "../internals/well-known-symbol";
import { getterFor as _getterFor, set as _set } from "../internals/internal-state";
// https://github.com/tc39/proposal-observable

var $$OBSERVABLE = wellKnownSymbol('observable');
var OBSERVABLE = 'Observable';
var SUBSCRIPTION = 'Subscription';
var SUBSCRIPTION_OBSERVER = 'SubscriptionObserver';
var getterFor = _getterFor;
var setInternalState = _set;
var getObservableInternalState = getterFor(OBSERVABLE);
var getSubscriptionInternalState = getterFor(SUBSCRIPTION);
var getSubscriptionObserverInternalState = getterFor(SUBSCRIPTION_OBSERVER);
var SubscriptionState = function (observer) {
  this.observer = anObject(observer);
  this.cleanup = null;
  this.subscriptionObserver = null;
};
SubscriptionState.prototype = {
  type: SUBSCRIPTION,
  clean: function () {
    var cleanup = this.cleanup;
    if (cleanup) {
      this.cleanup = null;
      try {
        cleanup();
      } catch (error) {
        hostReportErrors(error);
      }
    }
  },
  close: function () {
    if (!DESCRIPTORS) {
      var subscription = this.facade;
      var subscriptionObserver = this.subscriptionObserver;
      subscription.closed = true;
      if (subscriptionObserver) subscriptionObserver.closed = true;
    }
    this.observer = null;
  },
  isClosed: function () {
    return this.observer === null;
  }
};
var Subscription = function (observer, subscriber) {
  var subscriptionState = setInternalState(this, new SubscriptionState(observer));
  var start;
  if (!DESCRIPTORS) this.closed = false;
  try {
    if (start = getMethod(observer, 'start')) call(start, observer, this);
  } catch (error) {
    hostReportErrors(error);
  }
  if (subscriptionState.isClosed()) return;
  var subscriptionObserver = subscriptionState.subscriptionObserver = new SubscriptionObserver(subscriptionState);
  try {
    var cleanup = subscriber(subscriptionObserver);
    var subscription = cleanup;
    if (!isNullOrUndefined(cleanup)) subscriptionState.cleanup = isCallable(cleanup.unsubscribe) ? function () {
      subscription.unsubscribe();
    } : aCallable(cleanup);
  } catch (error) {
    subscriptionObserver.error(error);
    return;
  }
  if (subscriptionState.isClosed()) subscriptionState.clean();
};
Subscription.prototype = defineBuiltIns({}, {
  unsubscribe: function unsubscribe() {
    var subscriptionState = getSubscriptionInternalState(this);
    if (!subscriptionState.isClosed()) {
      subscriptionState.close();
      subscriptionState.clean();
    }
  }
});
if (DESCRIPTORS) defineBuiltInAccessor(Subscription.prototype, 'closed', {
  configurable: true,
  get: function closed() {
    return getSubscriptionInternalState(this).isClosed();
  }
});
var SubscriptionObserver = function (subscriptionState) {
  setInternalState(this, {
    type: SUBSCRIPTION_OBSERVER,
    subscriptionState: subscriptionState
  });
  if (!DESCRIPTORS) this.closed = false;
};
SubscriptionObserver.prototype = defineBuiltIns({}, {
  next: function next(value) {
    var subscriptionState = getSubscriptionObserverInternalState(this).subscriptionState;
    if (!subscriptionState.isClosed()) {
      var observer = subscriptionState.observer;
      try {
        var nextMethod = getMethod(observer, 'next');
        if (nextMethod) call(nextMethod, observer, value);
      } catch (error) {
        hostReportErrors(error);
      }
    }
  },
  error: function error(value) {
    var subscriptionState = getSubscriptionObserverInternalState(this).subscriptionState;
    if (!subscriptionState.isClosed()) {
      var observer = subscriptionState.observer;
      subscriptionState.close();
      try {
        var errorMethod = getMethod(observer, 'error');
        if (errorMethod) call(errorMethod, observer, value);else hostReportErrors(value);
      } catch (err) {
        hostReportErrors(err);
      }
      subscriptionState.clean();
    }
  },
  complete: function complete() {
    var subscriptionState = getSubscriptionObserverInternalState(this).subscriptionState;
    if (!subscriptionState.isClosed()) {
      var observer = subscriptionState.observer;
      subscriptionState.close();
      try {
        var completeMethod = getMethod(observer, 'complete');
        if (completeMethod) call(completeMethod, observer);
      } catch (error) {
        hostReportErrors(error);
      }
      subscriptionState.clean();
    }
  }
});
if (DESCRIPTORS) defineBuiltInAccessor(SubscriptionObserver.prototype, 'closed', {
  configurable: true,
  get: function closed() {
    return getSubscriptionObserverInternalState(this).subscriptionState.isClosed();
  }
});
var $Observable = function Observable(subscriber) {
  anInstance(this, ObservablePrototype);
  setInternalState(this, {
    type: OBSERVABLE,
    subscriber: aCallable(subscriber)
  });
};
var ObservablePrototype = $Observable.prototype;
defineBuiltIns(ObservablePrototype, {
  subscribe: function subscribe(observer) {
    var length = arguments.length;
    return new Subscription(isCallable(observer) ? {
      next: observer,
      error: length > 1 ? arguments[1] : undefined,
      complete: length > 2 ? arguments[2] : undefined
    } : isObject(observer) ? observer : {}, getObservableInternalState(this).subscriber);
  }
});
defineBuiltIn(ObservablePrototype, $$OBSERVABLE, function () {
  return this;
});
$({
  global: true,
  constructor: true,
  forced: true
}, {
  Observable: $Observable
});
setSpecies(OBSERVABLE);
const _cjs_default = {};
export default _cjs_default;
