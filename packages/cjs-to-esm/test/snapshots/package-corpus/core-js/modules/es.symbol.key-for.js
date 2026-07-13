import $ from "../internals/export";
import hasOwn from "../internals/has-own-property";
import isSymbol from "../internals/is-symbol";
import tryToString from "../internals/try-to-string";
import shared from "../internals/shared";
import NATIVE_SYMBOL_REGISTRY from "../internals/symbol-registry-detection";
var SymbolToStringRegistry = shared('symbol-to-string-registry');

// `Symbol.keyFor` method
// https://tc39.es/ecma262/#sec-symbol.keyfor
$({
  target: 'Symbol',
  stat: true,
  forced: !NATIVE_SYMBOL_REGISTRY
}, {
  keyFor: function keyFor(sym) {
    if (!isSymbol(sym)) throw new TypeError(tryToString(sym) + ' is not a symbol');
    if (hasOwn(SymbolToStringRegistry, sym)) return SymbolToStringRegistry[sym];
  }
});
const _cjs_default = {};
export default _cjs_default;
