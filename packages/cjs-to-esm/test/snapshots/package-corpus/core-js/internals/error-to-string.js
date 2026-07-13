import DESCRIPTORS from "../internals/descriptors";
import fails from "../internals/fails";
import anObject from "../internals/an-object";
import normalizeStringArgument from "../internals/normalize-string-argument";
var nativeErrorToString = Error.prototype.toString;
var INCORRECT_TO_STRING = fails(function () {
  if (DESCRIPTORS) {
    // Chrome 32- incorrectly call accessor
    // eslint-disable-next-line es/no-object-create, es/no-object-defineproperty -- safe
    var object = Object.create(Object.defineProperty({}, 'name', {
      get: function () {
        return this === object;
      }
    }));
    if (nativeErrorToString.call(object) !== 'true') return true;
  }
  // FF10- does not properly handle non-strings
  return nativeErrorToString.call({
    message: 1,
    name: 2
  }) !== '2: 1'
  // IE8 does not properly handle defaults
  || nativeErrorToString.call({}) !== 'Error';
});
const _cjs_default = INCORRECT_TO_STRING ? function toString() {
  var O = anObject(this);
  var name = normalizeStringArgument(O.name, 'Error');
  var message = normalizeStringArgument(O.message);
  return !name ? message : !message ? name : name + ': ' + message;
} : nativeErrorToString;
export default _cjs_default;
