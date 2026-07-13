import globalThis from "../internals/global-this";
import shared from "../internals/shared";
import hasOwn from "../internals/has-own-property";
import uid from "../internals/uid";
import NATIVE_SYMBOL from "../internals/symbol-constructor-detection";
import USE_SYMBOL_AS_UID from "../internals/use-symbol-as-uid";
var Symbol = globalThis.Symbol;
var WellKnownSymbolsStore = shared('wks');
var createWellKnownSymbol = USE_SYMBOL_AS_UID ? Symbol['for'] || Symbol : Symbol && Symbol.withoutSetter || uid;
const _cjs_default = function (name) {
  if (!hasOwn(WellKnownSymbolsStore, name)) {
    WellKnownSymbolsStore[name] = NATIVE_SYMBOL && hasOwn(Symbol, name) ? Symbol[name] : createWellKnownSymbol('Symbol.' + name);
  }
  return WellKnownSymbolsStore[name];
};
export default _cjs_default;
