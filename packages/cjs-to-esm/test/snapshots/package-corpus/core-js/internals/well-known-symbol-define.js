import path from "../internals/path";
import hasOwn from "../internals/has-own-property";
import { f as _f } from "../internals/well-known-symbol-wrapped";
import { f as _f2 } from "../internals/object-define-property";
var defineProperty = _f2;
const _cjs_default = function (NAME) {
  var Symbol = path.Symbol || (path.Symbol = {});
  if (!hasOwn(Symbol, NAME)) defineProperty(Symbol, NAME, {
    value: _f(NAME)
  });
};
export default _cjs_default;
