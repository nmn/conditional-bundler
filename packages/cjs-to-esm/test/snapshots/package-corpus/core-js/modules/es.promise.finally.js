import $ from "../internals/export";
import IS_PURE from "../internals/is-pure";
import NativePromiseConstructor from "../internals/promise-native-constructor";
import fails from "../internals/fails";
import getBuiltIn from "../internals/get-built-in";
import isCallable from "../internals/is-callable";
import speciesConstructor from "../internals/species-constructor";
import promiseResolve from "../internals/promise-resolve";
import defineBuiltIn from "../internals/define-built-in";
var NativePromisePrototype = NativePromiseConstructor && NativePromiseConstructor.prototype;

// Safari bug https://bugs.webkit.org/show_bug.cgi?id=200829
var NON_GENERIC = !!NativePromiseConstructor && fails(function () {
  // eslint-disable-next-line unicorn/no-thenable -- required for testing
  NativePromisePrototype['finally'].call({
    then: function () {/* empty */}
  }, function () {/* empty */});
});

// `Promise.prototype.finally` method
// https://tc39.es/ecma262/#sec-promise.prototype.finally
$({
  target: 'Promise',
  proto: true,
  real: true,
  forced: NON_GENERIC
}, {
  'finally': function (onFinally) {
    var C = speciesConstructor(this, getBuiltIn('Promise'));
    var isFunction = isCallable(onFinally);
    return this.then(isFunction ? function (x) {
      return promiseResolve(C, onFinally()).then(function () {
        return x;
      });
    } : onFinally, isFunction ? function (e) {
      return promiseResolve(C, onFinally()).then(function () {
        throw e;
      });
    } : onFinally);
  }
});

// makes sure that native promise-based APIs `Promise#finally` properly works with patched `Promise#then`
if (!IS_PURE && isCallable(NativePromiseConstructor)) {
  var method = getBuiltIn('Promise').prototype['finally'];
  if (NativePromisePrototype['finally'] !== method) {
    defineBuiltIn(NativePromisePrototype, 'finally', method, {
      unsafe: true
    });
  }
}
const _cjs_default = {};
export default _cjs_default;
