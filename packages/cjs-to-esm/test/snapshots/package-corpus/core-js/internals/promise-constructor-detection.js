import globalThis from "../internals/global-this";
import NativePromiseConstructor from "../internals/promise-native-constructor";
import isCallable from "../internals/is-callable";
import isForced from "../internals/is-forced";
import inspectSource from "../internals/inspect-source";
import wellKnownSymbol from "../internals/well-known-symbol";
import ENVIRONMENT from "../internals/environment";
import IS_PURE from "../internals/is-pure";
import V8_VERSION from "../internals/environment-v8-version";
var NativePromisePrototype = NativePromiseConstructor && NativePromiseConstructor.prototype;
var SPECIES = wellKnownSymbol('species');
var SUBCLASSING = false;
var NATIVE_PROMISE_REJECTION_EVENT = isCallable(globalThis.PromiseRejectionEvent);
var FORCED_PROMISE_CONSTRUCTOR = isForced('Promise', function () {
  var PROMISE_CONSTRUCTOR_SOURCE = inspectSource(NativePromiseConstructor);
  var GLOBAL_CORE_JS_PROMISE = PROMISE_CONSTRUCTOR_SOURCE !== String(NativePromiseConstructor);
  // V8 6.6 (Node 10 and Chrome 66) have a bug with resolving custom thenables
  // https://bugs.chromium.org/p/chromium/issues/detail?id=830565
  // We can't detect it synchronously, so just check versions
  if (!GLOBAL_CORE_JS_PROMISE && V8_VERSION === 66) return true;
  // We need Promise#{ catch, finally } in the pure version for preventing prototype pollution
  if (IS_PURE && !(NativePromisePrototype['catch'] && NativePromisePrototype['finally'])) return true;
  // We can't use @@species feature detection in V8 since it causes
  // deoptimization and performance degradation
  // https://github.com/zloirock/core-js/issues/679
  if (!V8_VERSION || V8_VERSION < 51 || !/native code/.test(PROMISE_CONSTRUCTOR_SOURCE)) {
    // Detect correctness of subclassing with @@species support
    var promise = new NativePromiseConstructor(function (resolve) {
      resolve(1);
    });
    var FakePromise = function (exec) {
      exec(function () {/* empty */}, function () {/* empty */});
    };
    var constructor = promise.constructor = {};
    constructor[SPECIES] = FakePromise;
    SUBCLASSING = promise.then(function () {/* empty */}) instanceof FakePromise;
    if (!SUBCLASSING) return true;
    // Unhandled rejections tracking support, NodeJS Promise without it fails @@species test
  }
  return !GLOBAL_CORE_JS_PROMISE && (ENVIRONMENT === 'BROWSER' || ENVIRONMENT === 'DENO') && !NATIVE_PROMISE_REJECTION_EVENT;
});
const _cjs_default = {
  CONSTRUCTOR: FORCED_PROMISE_CONSTRUCTOR,
  REJECTION_EVENT: NATIVE_PROMISE_REJECTION_EVENT,
  SUBCLASSING: SUBCLASSING
};
const _CONSTRUCTOR = _cjs_default["CONSTRUCTOR"];
export { _CONSTRUCTOR as CONSTRUCTOR };
const _REJECTION_EVENT = _cjs_default["REJECTION_EVENT"];
export { _REJECTION_EVENT as REJECTION_EVENT };
const _SUBCLASSING = _cjs_default["SUBCLASSING"];
export { _SUBCLASSING as SUBCLASSING };
export default _cjs_default;
