import globalThis from "../internals/global-this";
import defineWellKnownSymbol from "../internals/well-known-symbol-define";
import { f as _f } from "../internals/object-define-property";
import { f as _f2 } from "../internals/object-get-own-property-descriptor";
var defineProperty = _f;
var getOwnPropertyDescriptor = _f2;
var Symbol = globalThis.Symbol;

// `Symbol.dispose` well-known symbol
// https://github.com/tc39/proposal-explicit-resource-management
defineWellKnownSymbol('dispose');
if (Symbol) {
  var descriptor = getOwnPropertyDescriptor(Symbol, 'dispose');
  // workaround of NodeJS 20.4 bug
  // https://github.com/nodejs/node/issues/48699
  // and incorrect descriptor from some transpilers and userland helpers
  if (descriptor.enumerable && descriptor.configurable && descriptor.writable) {
    defineProperty(Symbol, 'dispose', {
      value: descriptor.value,
      enumerable: false,
      configurable: false,
      writable: false
    });
  }
}
const _cjs_default = {};
export default _cjs_default;
