import _cjs_import from "../internals/string-multibyte";
var charAt = _cjs_import.charAt;

// `AdvanceStringIndex` abstract operation
// https://tc39.es/ecma262/#sec-advancestringindex
const _cjs_default = function (S, index, unicode) {
  return index + (unicode ? charAt(S, index).length || 1 : 1);
};
export default _cjs_default;
