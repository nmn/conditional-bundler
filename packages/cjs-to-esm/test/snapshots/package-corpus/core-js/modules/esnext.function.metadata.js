import wellKnownSymbol from "../internals/well-known-symbol";
import _cjs_import from "../internals/object-define-property";
var defineProperty = _cjs_import.f;
var METADATA = wellKnownSymbol('metadata');
var FunctionPrototype = Function.prototype;

// Function.prototype[@@metadata]
// https://github.com/tc39/proposal-decorator-metadata
if (FunctionPrototype[METADATA] === undefined) {
  defineProperty(FunctionPrototype, METADATA, {
    value: null
  });
}
const _cjs_default = {};
export default _cjs_default;
