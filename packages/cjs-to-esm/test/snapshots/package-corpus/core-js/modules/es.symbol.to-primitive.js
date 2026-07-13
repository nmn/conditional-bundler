import defineWellKnownSymbol from "../internals/well-known-symbol-define";
import defineSymbolToPrimitive from "../internals/symbol-define-to-primitive";
// `Symbol.toPrimitive` well-known symbol
// https://tc39.es/ecma262/#sec-symbol.toprimitive
defineWellKnownSymbol('toPrimitive');

// `Symbol.prototype[@@toPrimitive]` method
// https://tc39.es/ecma262/#sec-symbol.prototype-@@toprimitive
defineSymbolToPrimitive();
const _cjs_default = {};
export default _cjs_default;
