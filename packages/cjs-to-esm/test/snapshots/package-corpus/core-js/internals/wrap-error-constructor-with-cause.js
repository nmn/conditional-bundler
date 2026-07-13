import getBuiltIn from "../internals/get-built-in";
import hasOwn from "../internals/has-own-property";
import createNonEnumerableProperty from "../internals/create-non-enumerable-property";
import isPrototypeOf from "../internals/object-is-prototype-of";
import setPrototypeOf from "../internals/object-set-prototype-of";
import copyConstructorProperties from "../internals/copy-constructor-properties";
import proxyAccessor from "../internals/proxy-accessor";
import inheritIfRequired from "../internals/inherit-if-required";
import normalizeStringArgument from "../internals/normalize-string-argument";
import installErrorCause from "../internals/install-error-cause";
import installErrorStack from "../internals/error-stack-install";
import DESCRIPTORS from "../internals/descriptors";
import IS_PURE from "../internals/is-pure";
const _cjs_default = function (FULL_NAME, wrapper, FORCED, IS_AGGREGATE_ERROR) {
  var STACK_TRACE_LIMIT = 'stackTraceLimit';
  var OPTIONS_POSITION = IS_AGGREGATE_ERROR ? 2 : 1;
  var path = FULL_NAME.split('.');
  var ERROR_NAME = path[path.length - 1];
  var OriginalError = getBuiltIn.apply(null, path);
  if (!OriginalError) return;
  var OriginalErrorPrototype = OriginalError.prototype;

  // V8 9.3- bug https://bugs.chromium.org/p/v8/issues/detail?id=12006
  if (!IS_PURE && hasOwn(OriginalErrorPrototype, 'cause')) delete OriginalErrorPrototype.cause;
  if (!FORCED) return OriginalError;
  var BaseError = getBuiltIn('Error');
  var WrappedError = wrapper(function (a, b) {
    var message = normalizeStringArgument(IS_AGGREGATE_ERROR ? b : a, undefined);
    var result = IS_AGGREGATE_ERROR ? new OriginalError(a) : new OriginalError();
    if (message !== undefined) createNonEnumerableProperty(result, 'message', message);
    installErrorStack(result, WrappedError, result.stack, 2);
    if (this && isPrototypeOf(OriginalErrorPrototype, this)) inheritIfRequired(result, this, WrappedError);
    if (arguments.length > OPTIONS_POSITION) installErrorCause(result, arguments[OPTIONS_POSITION]);
    return result;
  });
  WrappedError.prototype = OriginalErrorPrototype;
  if (ERROR_NAME !== 'Error') {
    if (setPrototypeOf) setPrototypeOf(WrappedError, BaseError);else copyConstructorProperties(WrappedError, BaseError, {
      name: true
    });
  } else if (DESCRIPTORS && STACK_TRACE_LIMIT in OriginalError) {
    proxyAccessor(WrappedError, OriginalError, STACK_TRACE_LIMIT);
    proxyAccessor(WrappedError, OriginalError, 'prepareStackTrace');
  }
  copyConstructorProperties(WrappedError, OriginalError);
  if (!IS_PURE) try {
    // Safari 13- bug: WebAssembly errors does not have a proper `.name`
    if (OriginalErrorPrototype.name !== ERROR_NAME) {
      createNonEnumerableProperty(OriginalErrorPrototype, 'name', ERROR_NAME);
    }
    OriginalErrorPrototype.constructor = WrappedError;
  } catch (error) {/* empty */}
  return WrappedError;
};
export default _cjs_default;
