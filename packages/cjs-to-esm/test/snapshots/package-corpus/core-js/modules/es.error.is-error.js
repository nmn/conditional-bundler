import $ from "../internals/export";
import getBuiltIn from "../internals/get-built-in";
import isObject from "../internals/is-object";
import classof from "../internals/classof";
import fails from "../internals/fails";
var ERROR = 'Error';
var DOM_EXCEPTION = 'DOMException';
// eslint-disable-next-line es/no-object-setprototypeof, no-proto -- safe
var PROTOTYPE_SETTING_AVAILABLE = Object.setPrototypeOf || {}.__proto__;
var DOMException = getBuiltIn(DOM_EXCEPTION);
var $Error = Error;
// eslint-disable-next-line es/no-error-iserror -- safe
var $isError = $Error.isError;
var FORCED = !$isError || !PROTOTYPE_SETTING_AVAILABLE || fails(function () {
  // Bun, isNativeError-based implementations, some buggy structuredClone-based implementations, etc.
  // https://github.com/oven-sh/bun/issues/15821
  return DOMException && !$isError(new DOMException(DOM_EXCEPTION)) ||
  // structuredClone-based implementations
  // eslint-disable-next-line es/no-error-cause -- detection
  !$isError(new $Error(ERROR, {
    cause: function () {/* empty */}
  })) ||
  // instanceof-based and FF Error#stack-based implementations
  $isError(getBuiltIn('Object', 'create')($Error.prototype));
});

// `Error.isError` method
// https://tc39.es/ecma262/#sec-error.iserror
$({
  target: 'Error',
  stat: true,
  sham: true,
  forced: FORCED
}, {
  isError: function isError(arg) {
    if (!isObject(arg)) return false;
    var tag = classof(arg);
    return tag === ERROR || tag === DOM_EXCEPTION;
  }
});
const _cjs_default = {};
export default _cjs_default;
