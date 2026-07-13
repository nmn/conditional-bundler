import $ from "../internals/export";
import getBuiltIn from "../internals/get-built-in";
import call from "../internals/function-call";
import anObject from "../internals/an-object";
import isConstructor from "../internals/is-constructor";
import getIterator from "../internals/get-iterator";
import getIteratorMethod from "../internals/get-iterator-method";
import getMethod from "../internals/get-method";
import iterate from "../internals/iterate";
import wellKnownSymbol from "../internals/well-known-symbol";
var $$OBSERVABLE = wellKnownSymbol('observable');

// `Observable.from` method
// https://github.com/tc39/proposal-observable
$({
  target: 'Observable',
  stat: true,
  forced: true
}, {
  from: function from(x) {
    var C = isConstructor(this) ? this : getBuiltIn('Observable');
    var observableMethod = getMethod(anObject(x), $$OBSERVABLE);
    if (observableMethod) {
      var observable = anObject(call(observableMethod, x));
      return observable.constructor === C ? observable : new C(function (observer) {
        return observable.subscribe(observer);
      });
    }
    var iteratorMethod = getIteratorMethod(x);
    // validate that x is iterable synchronously during `from()` call
    if (!iteratorMethod) getIterator(x);
    return new C(function (observer) {
      iterate(getIterator(x, iteratorMethod), function (it, stop) {
        observer.next(it);
        if (observer.closed) return stop();
      }, {
        IS_ITERATOR: true,
        INTERRUPTED: true
      });
      observer.complete();
    });
  }
});
const _cjs_default = {};
export default _cjs_default;
