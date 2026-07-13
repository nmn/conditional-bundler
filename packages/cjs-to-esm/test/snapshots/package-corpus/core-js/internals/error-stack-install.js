import createNonEnumerableProperty from "../internals/create-non-enumerable-property";
import clearErrorStack from "../internals/error-stack-clear";
import ERROR_STACK_INSTALLABLE from "../internals/error-stack-installable";
// non-standard V8
// eslint-disable-next-line es/no-nonstandard-error-properties -- safe
var captureStackTrace = Error.captureStackTrace;
const _cjs_default = function (error, C, stack, dropEntries) {
  if (ERROR_STACK_INSTALLABLE) {
    if (captureStackTrace) captureStackTrace(error, C);else createNonEnumerableProperty(error, 'stack', clearErrorStack(stack, dropEntries));
  }
};
export default _cjs_default;
