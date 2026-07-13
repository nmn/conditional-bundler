import $ from "../internals/export";
import getBuiltIn from "../internals/get-built-in";
import isConstructor from "../internals/is-constructor";
var Array = getBuiltIn('Array');

// `Observable.of` method
// https://github.com/tc39/proposal-observable
$({
  target: 'Observable',
  stat: true,
  forced: true
}, {
  of: function of() {
    var C = isConstructor(this) ? this : getBuiltIn('Observable');
    var length = arguments.length;
    var items = Array(length);
    var index = 0;
    while (index < length) items[index] = arguments[index++];
    return new C(function (observer) {
      for (var i = 0; i < length; i++) {
        observer.next(items[i]);
        if (observer.closed) return;
      }
      observer.complete();
    });
  }
});
const _cjs_default = {};
export default _cjs_default;
