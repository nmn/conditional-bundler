import $ from "../internals/export";
import getBuiltIn from "../internals/get-built-in";
import IS_PURE from "../internals/is-pure";
import NativePromiseConstructor from "../internals/promise-native-constructor";
import _cjs_import from "../internals/promise-constructor-detection";
import promiseResolve from "../internals/promise-resolve";
var FORCED_PROMISE_CONSTRUCTOR = _cjs_import.CONSTRUCTOR;
var PromiseConstructorWrapper = getBuiltIn('Promise');
var CHECK_WRAPPER = IS_PURE && !FORCED_PROMISE_CONSTRUCTOR;

// `Promise.resolve` method
// https://tc39.es/ecma262/#sec-promise.resolve
$({
  target: 'Promise',
  stat: true,
  forced: IS_PURE || FORCED_PROMISE_CONSTRUCTOR
}, {
  resolve: function resolve(x) {
    return promiseResolve(CHECK_WRAPPER && this === PromiseConstructorWrapper ? NativePromiseConstructor : this, x);
  }
});
const _cjs_default = {};
export default _cjs_default;
