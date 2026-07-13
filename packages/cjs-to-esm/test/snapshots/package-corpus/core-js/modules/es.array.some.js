import $ from "../internals/export";
import { some as _some } from "../internals/array-iteration";
import arrayMethodIsStrict from "../internals/array-method-is-strict";
var $some = _some;
var STRICT_METHOD = arrayMethodIsStrict('some');

// `Array.prototype.some` method
// https://tc39.es/ecma262/#sec-array.prototype.some
$({
  target: 'Array',
  proto: true,
  forced: !STRICT_METHOD
}, {
  some: function some(callbackfn /* , thisArg */) {
    return $some(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
  }
});
const _cjs_default = {};
export default _cjs_default;
