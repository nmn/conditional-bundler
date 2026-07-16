import globalThis from "../internals/global-this";
import fails from "../internals/fails";
import uncurryThis from "../internals/function-uncurry-this";
import toString from "../internals/to-string";
import _cjs_import from "../internals/string-trim";
import whitespaces from "../internals/whitespaces";
var trim = _cjs_import.trim;
var charAt = uncurryThis(''.charAt);
var $parseFloat = globalThis.parseFloat;
var Symbol = globalThis.Symbol;
var ITERATOR = Symbol && Symbol.iterator;
var FORCED = 1 / $parseFloat(whitespaces + '-0') !== -Infinity
// MS Edge 18- broken with boxed symbols
|| ITERATOR && !fails(function () {
  $parseFloat(Object(ITERATOR));
});

// `parseFloat` method
// https://tc39.es/ecma262/#sec-parsefloat-string
const _cjs_default = FORCED ? function parseFloat(string) {
  var trimmedString = trim(toString(string));
  var result = $parseFloat(trimmedString);
  return result === 0 && charAt(trimmedString, 0) === '-' ? -0 : result;
} : $parseFloat;
export default _cjs_default;
