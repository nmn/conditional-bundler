import globalThis from "../internals/global-this";
import defineWellKnownSymbol from "../internals/well-known-symbol-define";
import _cjs_import from "../internals/object-define-property";
import _cjs_import2 from "../internals/object-get-own-property-descriptor";
var defineProperty = _cjs_import.f;
var getOwnPropertyDescriptor = _cjs_import2.f;
var Symbol = globalThis.Symbol;

// `Symbol.asyncDispose` well-known symbol
// https://github.com/tc39/proposal-async-explicit-resource-management
defineWellKnownSymbol('asyncDispose');
if (Symbol) {
  var descriptor = getOwnPropertyDescriptor(Symbol, 'asyncDispose');
  // workaround of NodeJS 20.4 bug
  // https://github.com/nodejs/node/issues/48699
  // and incorrect descriptor from some transpilers and userland helpers
  if (descriptor.enumerable && descriptor.configurable && descriptor.writable) {
    defineProperty(Symbol, 'asyncDispose', {
      value: descriptor.value,
      enumerable: false,
      configurable: false,
      writable: false
    });
  }
}
const _cjs_default = {};
export default _cjs_default;
