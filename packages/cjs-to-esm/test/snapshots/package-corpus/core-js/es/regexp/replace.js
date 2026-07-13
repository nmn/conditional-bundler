import "../../modules/es.regexp.exec";
import "../../modules/es.string.replace";
import call from "../../internals/function-call";
import wellKnownSymbol from "../../internals/well-known-symbol";
var REPLACE = wellKnownSymbol('replace');
const _cjs_default = function (it, str, replacer) {
  return call(RegExp.prototype[REPLACE], it, str, replacer);
};
export default _cjs_default;
