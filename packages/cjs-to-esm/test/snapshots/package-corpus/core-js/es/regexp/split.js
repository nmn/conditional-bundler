import "../../modules/es.regexp.exec";
import "../../modules/es.string.split";
import call from "../../internals/function-call";
import wellKnownSymbol from "../../internals/well-known-symbol";
var SPLIT = wellKnownSymbol('split');
const _cjs_default = function (it, str, limit) {
  return call(RegExp.prototype[SPLIT], it, str, limit);
};
export default _cjs_default;
