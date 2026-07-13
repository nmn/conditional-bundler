import { charAt as _charAt } from "../internals/string-multibyte";
var charAt = _charAt;

// `AdvanceStringIndex` abstract operation
// https://tc39.es/ecma262/#sec-advancestringindex
const _cjs_default = function (S, index, unicode) {
  return index + (unicode ? charAt(S, index).length || 1 : 1);
};
export default _cjs_default;
