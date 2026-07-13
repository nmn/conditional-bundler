import { forEach as _forEach } from "../internals/array-iteration";
import arrayMethodIsStrict from "../internals/array-method-is-strict";
var $forEach = _forEach;
var STRICT_METHOD = arrayMethodIsStrict('forEach');

// `Array.prototype.forEach` method implementation
// https://tc39.es/ecma262/#sec-array.prototype.foreach
const _cjs_default = !STRICT_METHOD ? function forEach(callbackfn /* , thisArg */) {
  return $forEach(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
  // eslint-disable-next-line es/no-array-prototype-foreach -- safe
} : [].forEach;
export default _cjs_default;
