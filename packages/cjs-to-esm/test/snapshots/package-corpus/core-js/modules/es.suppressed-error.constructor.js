import $ from "../internals/export";
import globalThis from "../internals/global-this";
import isPrototypeOf from "../internals/object-is-prototype-of";
import getPrototypeOf from "../internals/object-get-prototype-of";
import setPrototypeOf from "../internals/object-set-prototype-of";
import copyConstructorProperties from "../internals/copy-constructor-properties";
import create from "../internals/object-create";
import createNonEnumerableProperty from "../internals/create-non-enumerable-property";
import createPropertyDescriptor from "../internals/create-property-descriptor";
import installErrorStack from "../internals/error-stack-install";
import normalizeStringArgument from "../internals/normalize-string-argument";
import wellKnownSymbol from "../internals/well-known-symbol";
import fails from "../internals/fails";
import IS_PURE from "../internals/is-pure";
var NativeSuppressedError = globalThis.SuppressedError;
var TO_STRING_TAG = wellKnownSymbol('toStringTag');
var $Error = Error;

// https://github.com/oven-sh/bun/issues/9282
var WRONG_ARITY = !!NativeSuppressedError && NativeSuppressedError.length !== 3;

// https://github.com/oven-sh/bun/issues/9283
var EXTRA_ARGS_SUPPORT = !!NativeSuppressedError && fails(function () {
  return new NativeSuppressedError(1, 2, 3, {
    cause: 4
  }).cause === 4;
});
var PATCH = WRONG_ARITY || EXTRA_ARGS_SUPPORT;
var $SuppressedError = function SuppressedError(error, suppressed, message) {
  var isInstance = isPrototypeOf(SuppressedErrorPrototype, this);
  var that;
  if (setPrototypeOf) {
    that = PATCH && (!isInstance || getPrototypeOf(this) === SuppressedErrorPrototype) ? new NativeSuppressedError() : setPrototypeOf(new $Error(), isInstance ? getPrototypeOf(this) : SuppressedErrorPrototype);
  } else {
    that = isInstance ? this : create(SuppressedErrorPrototype);
    createNonEnumerableProperty(that, TO_STRING_TAG, 'Error');
  }
  if (message !== undefined) createNonEnumerableProperty(that, 'message', normalizeStringArgument(message));
  installErrorStack(that, $SuppressedError, that.stack, 1);
  createNonEnumerableProperty(that, 'error', error);
  createNonEnumerableProperty(that, 'suppressed', suppressed);
  return that;
};
if (setPrototypeOf) setPrototypeOf($SuppressedError, $Error);else copyConstructorProperties($SuppressedError, $Error, {
  name: true
});
var SuppressedErrorPrototype = $SuppressedError.prototype = PATCH ? NativeSuppressedError.prototype : create($Error.prototype, {
  constructor: createPropertyDescriptor(1, $SuppressedError),
  message: createPropertyDescriptor(1, ''),
  name: createPropertyDescriptor(1, 'SuppressedError')
});
if (PATCH && !IS_PURE) SuppressedErrorPrototype.constructor = $SuppressedError;

// `SuppressedError` constructor
// https://github.com/tc39/proposal-explicit-resource-management
$({
  global: true,
  constructor: true,
  arity: 3,
  forced: PATCH
}, {
  SuppressedError: $SuppressedError
});
const _cjs_default = {};
export default _cjs_default;
