import wellKnownSymbol from "../internals/well-known-symbol";
import { f as _f } from "../internals/object-define-property";
var defineProperty = _f;
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
