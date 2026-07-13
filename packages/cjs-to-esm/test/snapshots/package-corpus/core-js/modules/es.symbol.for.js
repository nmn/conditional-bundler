import $ from "../internals/export";
import getBuiltIn from "../internals/get-built-in";
import hasOwn from "../internals/has-own-property";
import toString from "../internals/to-string";
import shared from "../internals/shared";
import NATIVE_SYMBOL_REGISTRY from "../internals/symbol-registry-detection";
var StringToSymbolRegistry = shared('string-to-symbol-registry');
var SymbolToStringRegistry = shared('symbol-to-string-registry');

// `Symbol.for` method
// https://tc39.es/ecma262/#sec-symbol.for
$({
  target: 'Symbol',
  stat: true,
  forced: !NATIVE_SYMBOL_REGISTRY
}, {
  'for': function (key) {
    var string = toString(key);
    if (hasOwn(StringToSymbolRegistry, string)) return StringToSymbolRegistry[string];
    var symbol = getBuiltIn('Symbol')(string);
    StringToSymbolRegistry[string] = symbol;
    SymbolToStringRegistry[symbol] = string;
    return symbol;
  }
});
const _cjs_default = {};
export default _cjs_default;
