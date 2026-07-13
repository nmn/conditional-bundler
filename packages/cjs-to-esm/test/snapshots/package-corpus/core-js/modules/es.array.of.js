import $ from "../internals/export";
import fails from "../internals/fails";
import isConstructor from "../internals/is-constructor";
import createProperty from "../internals/create-property";
import setArrayLength from "../internals/array-set-length";
var $Array = Array;
var ISNT_GENERIC = fails(function () {
  function F() {/* empty */}
  // eslint-disable-next-line es/no-array-of -- safe
  return !($Array.of.call(F) instanceof F);
});

// `Array.of` method
// https://tc39.es/ecma262/#sec-array.of
// WebKit Array.of isn't generic
$({
  target: 'Array',
  stat: true,
  forced: ISNT_GENERIC
}, {
  of: function of(/* ...args */
  ) {
    var index = 0;
    var argumentsLength = arguments.length;
    var result = new (isConstructor(this) ? this : $Array)(argumentsLength);
    while (argumentsLength > index) createProperty(result, index, arguments[index++]);
    setArrayLength(result, argumentsLength);
    return result;
  }
});
const _cjs_default = {};
export default _cjs_default;
