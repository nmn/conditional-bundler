import path from "../internals/path";
import hasOwn from "../internals/has-own-property";
import wrappedWellKnownSymbolModule from "../internals/well-known-symbol-wrapped";
import _cjs_import from "../internals/object-define-property";
var defineProperty = _cjs_import.f;
const _cjs_default = function (NAME) {
  var Symbol = path.Symbol || (path.Symbol = {});
  if (!hasOwn(Symbol, NAME)) defineProperty(Symbol, NAME, {
    value: wrappedWellKnownSymbolModule.f(NAME)
  });
};
export default _cjs_default;
