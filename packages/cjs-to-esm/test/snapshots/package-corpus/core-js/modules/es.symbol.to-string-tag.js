import getBuiltIn from "../internals/get-built-in";
import defineWellKnownSymbol from "../internals/well-known-symbol-define";
import setToStringTag from "../internals/set-to-string-tag";
// `Symbol.toStringTag` well-known symbol
// https://tc39.es/ecma262/#sec-symbol.tostringtag
defineWellKnownSymbol('toStringTag');

// `Symbol.prototype[@@toStringTag]` property
// https://tc39.es/ecma262/#sec-symbol.prototype-@@tostringtag
setToStringTag(getBuiltIn('Symbol'), 'Symbol');
const _cjs_default = {};
export default _cjs_default;
