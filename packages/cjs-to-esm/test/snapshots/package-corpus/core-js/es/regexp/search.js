import "../../modules/es.regexp.exec";
import "../../modules/es.string.search";
import call from "../../internals/function-call";
import wellKnownSymbol from "../../internals/well-known-symbol";
var SEARCH = wellKnownSymbol('search');
const _cjs_default = function (it, str) {
  return call(RegExp.prototype[SEARCH], it, str);
};
export default _cjs_default;
