import $ from "../internals/export";
import IS_PURE from "../internals/is-pure";
import _cjs_import from "../internals/promise-constructor-detection";
import NativePromiseConstructor from "../internals/promise-native-constructor";
import getBuiltIn from "../internals/get-built-in";
import isCallable from "../internals/is-callable";
import defineBuiltIn from "../internals/define-built-in";
var FORCED_PROMISE_CONSTRUCTOR = _cjs_import.CONSTRUCTOR;
var NativePromisePrototype = NativePromiseConstructor && NativePromiseConstructor.prototype;

// `Promise.prototype.catch` method
// https://tc39.es/ecma262/#sec-promise.prototype.catch
$({
  target: 'Promise',
  proto: true,
  forced: FORCED_PROMISE_CONSTRUCTOR,
  real: true
}, {
  'catch': function (onRejected) {
    return this.then(undefined, onRejected);
  }
});

// makes sure that native promise-based APIs `Promise#catch` properly works with patched `Promise#then`
if (!IS_PURE && isCallable(NativePromiseConstructor)) {
  var method = getBuiltIn('Promise').prototype['catch'];
  if (NativePromisePrototype['catch'] !== method) {
    defineBuiltIn(NativePromisePrototype, 'catch', method, {
      unsafe: true
    });
  }
}
const _cjs_default = {};
export default _cjs_default;
