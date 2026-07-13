import $ from "../internals/export";
import DESCRIPTORS from "../internals/descriptors";
import globalThis from "../internals/global-this";
import call from "../internals/function-call";
import uncurryThis from "../internals/function-uncurry-this";
import hasOwn from "../internals/has-own-property";
import isCallable from "../internals/is-callable";
import isPrototypeOf from "../internals/object-is-prototype-of";
import toString from "../internals/to-string";
import defineBuiltInAccessor from "../internals/define-built-in-accessor";
import copyConstructorProperties from "../internals/copy-constructor-properties";
var NativeSymbol = globalThis.Symbol;
var SymbolPrototype = NativeSymbol && NativeSymbol.prototype;
if (DESCRIPTORS && isCallable(NativeSymbol) && (!('description' in SymbolPrototype) ||
// Safari 12 bug
NativeSymbol().description !== undefined)) {
  var EmptyStringDescriptionStore = {};
  // wrap Symbol constructor for correct work with undefined description
  var SymbolWrapper = function Symbol() {
    var description = arguments.length < 1 || arguments[0] === undefined ? undefined : toString(arguments[0]);
    var result = isPrototypeOf(SymbolPrototype, this)
    // eslint-disable-next-line sonarjs/inconsistent-function-call -- ok
    ? new NativeSymbol(description)
    // in Edge 13, String(Symbol(undefined)) === 'Symbol(undefined)'
    : description === undefined ? NativeSymbol() : NativeSymbol(description);
    if (description === '') EmptyStringDescriptionStore[result] = true;
    return result;
  };
  copyConstructorProperties(SymbolWrapper, NativeSymbol);
  // wrap Symbol.for for correct handling of empty string descriptions
  var nativeFor = SymbolWrapper['for'];
  SymbolWrapper['for'] = {
    'for': function (key) {
      var stringKey = toString(key);
      var symbol = call(nativeFor, this, stringKey);
      if (stringKey === '') EmptyStringDescriptionStore[symbol] = true;
      return symbol;
    }
  }['for'];
  SymbolWrapper.prototype = SymbolPrototype;
  SymbolPrototype.constructor = SymbolWrapper;
  var NATIVE_SYMBOL = String(NativeSymbol('description detection')) === 'Symbol(description detection)';
  var thisSymbolValue = uncurryThis(SymbolPrototype.valueOf);
  var symbolDescriptiveString = uncurryThis(SymbolPrototype.toString);
  var regexp = /^Symbol\((.*)\)[^)]+$/;
  var replace = uncurryThis(''.replace);
  var stringSlice = uncurryThis(''.slice);
  defineBuiltInAccessor(SymbolPrototype, 'description', {
    configurable: true,
    get: function description() {
      var symbol = thisSymbolValue(this);
      if (hasOwn(EmptyStringDescriptionStore, symbol)) return '';
      var string = symbolDescriptiveString(symbol);
      var desc = NATIVE_SYMBOL ? stringSlice(string, 7, -1) : replace(string, regexp, '$1');
      return desc === '' ? undefined : desc;
    }
  });
  $({
    global: true,
    constructor: true,
    forced: true
  }, {
    Symbol: SymbolWrapper
  });
}
const _cjs_default = {};
export default _cjs_default;
