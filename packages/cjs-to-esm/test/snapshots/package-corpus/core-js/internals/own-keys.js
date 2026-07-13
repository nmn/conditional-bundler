import getBuiltIn from "../internals/get-built-in";
import uncurryThis from "../internals/function-uncurry-this";
import { f as _f } from "../internals/object-get-own-property-names";
import { f as _f2 } from "../internals/object-get-own-property-symbols";
import anObject from "../internals/an-object";
var concat = uncurryThis([].concat);

// all object keys, includes non-enumerable and symbols
const _cjs_default = getBuiltIn('Reflect', 'ownKeys') || function ownKeys(it) {
  var keys = _f(anObject(it));
  var getOwnPropertySymbols = _f2;
  return getOwnPropertySymbols ? concat(keys, getOwnPropertySymbols(it)) : keys;
};
export default _cjs_default;
