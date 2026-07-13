import $ from "../internals/export";
import isPrototypeOf from "../internals/object-is-prototype-of";
import getPrototypeOf from "../internals/object-get-prototype-of";
import setPrototypeOf from "../internals/object-set-prototype-of";
import copyConstructorProperties from "../internals/copy-constructor-properties";
import create from "../internals/object-create";
import createNonEnumerableProperty from "../internals/create-non-enumerable-property";
import createPropertyDescriptor from "../internals/create-property-descriptor";
import installErrorCause from "../internals/install-error-cause";
import installErrorStack from "../internals/error-stack-install";
import iterate from "../internals/iterate";
import normalizeStringArgument from "../internals/normalize-string-argument";
import wellKnownSymbol from "../internals/well-known-symbol";
var TO_STRING_TAG = wellKnownSymbol('toStringTag');
var $Error = Error;
var push = [].push;
var $AggregateError = function AggregateError(errors, message /* , options */) {
  var isInstance = isPrototypeOf(AggregateErrorPrototype, this);
  var that;
  if (setPrototypeOf) {
    that = setPrototypeOf(new $Error(), isInstance ? getPrototypeOf(this) : AggregateErrorPrototype);
  } else {
    that = isInstance ? this : create(AggregateErrorPrototype);
    createNonEnumerableProperty(that, TO_STRING_TAG, 'Error');
  }
  if (message !== undefined) createNonEnumerableProperty(that, 'message', normalizeStringArgument(message));
  installErrorStack(that, $AggregateError, that.stack, 1);
  if (arguments.length > 2) installErrorCause(that, arguments[2]);
  var errorsArray = [];
  iterate(errors, push, {
    that: errorsArray
  });
  createNonEnumerableProperty(that, 'errors', errorsArray);
  return that;
};
if (setPrototypeOf) setPrototypeOf($AggregateError, $Error);else copyConstructorProperties($AggregateError, $Error, {
  name: true
});
var AggregateErrorPrototype = $AggregateError.prototype = create($Error.prototype, {
  constructor: createPropertyDescriptor(1, $AggregateError),
  message: createPropertyDescriptor(1, ''),
  name: createPropertyDescriptor(1, 'AggregateError')
});

// `AggregateError` constructor
// https://tc39.es/ecma262/#sec-aggregate-error-constructor
$({
  global: true,
  constructor: true,
  arity: 2
}, {
  AggregateError: $AggregateError
});
const _cjs_default = {};
export default _cjs_default;
