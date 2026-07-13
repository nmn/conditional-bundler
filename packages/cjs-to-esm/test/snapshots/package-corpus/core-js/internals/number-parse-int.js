import globalThis from "../internals/global-this";
import fails from "../internals/fails";
import uncurryThis from "../internals/function-uncurry-this";
import toString from "../internals/to-string";
import { trim as _trim } from "../internals/string-trim";
import whitespaces from "../internals/whitespaces";
var trim = _trim;
var $parseInt = globalThis.parseInt;
var Symbol = globalThis.Symbol;
var ITERATOR = Symbol && Symbol.iterator;
var hex = /^[+-]?0x/i;
var exec = uncurryThis(hex.exec);
var FORCED = $parseInt(whitespaces + '08') !== 8 || $parseInt(whitespaces + '0x16') !== 22
// MS Edge 18- broken with boxed symbols
|| ITERATOR && !fails(function () {
  $parseInt(Object(ITERATOR));
});

// `parseInt` method
// https://tc39.es/ecma262/#sec-parseint-string-radix
const _cjs_default = FORCED ? function parseInt(string, radix) {
  var S = trim(toString(string));
  return $parseInt(S, radix >>> 0 || (exec(hex, S) ? 16 : 10));
} : $parseInt;
export default _cjs_default;
