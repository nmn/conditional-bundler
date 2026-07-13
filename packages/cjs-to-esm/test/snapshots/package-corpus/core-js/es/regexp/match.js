import "../../modules/es.regexp.exec";
import "../../modules/es.string.match";
import call from "../../internals/function-call";
import wellKnownSymbol from "../../internals/well-known-symbol";
var MATCH = wellKnownSymbol('match');
const _cjs_default = function (it, str) {
  return call(RegExp.prototype[MATCH], it, str);
};
export default _cjs_default;
