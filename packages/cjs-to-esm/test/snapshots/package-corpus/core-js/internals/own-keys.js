import getBuiltIn from "../internals/get-built-in";
import uncurryThis from "../internals/function-uncurry-this";
import getOwnPropertyNamesModule from "../internals/object-get-own-property-names";
import getOwnPropertySymbolsModule from "../internals/object-get-own-property-symbols";
import anObject from "../internals/an-object";
var concat = uncurryThis([].concat);

// all object keys, includes non-enumerable and symbols
const _cjs_default = getBuiltIn('Reflect', 'ownKeys') || function ownKeys(it) {
  var keys = getOwnPropertyNamesModule.f(anObject(it));
  var getOwnPropertySymbols = getOwnPropertySymbolsModule.f;
  return getOwnPropertySymbols ? concat(keys, getOwnPropertySymbols(it)) : keys;
};
export default _cjs_default;
