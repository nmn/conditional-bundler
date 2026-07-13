import isObject from "../internals/is-object";
import classof from "../internals/classof-raw";
import wellKnownSymbol from "../internals/well-known-symbol";
var MATCH = wellKnownSymbol('match');

// `IsRegExp` abstract operation
// https://tc39.es/ecma262/#sec-isregexp
const _cjs_default = function (it) {
  var isRegExp;
  return isObject(it) && ((isRegExp = it[MATCH]) !== undefined ? !!isRegExp : classof(it) === 'RegExp');
};
export default _cjs_default;
