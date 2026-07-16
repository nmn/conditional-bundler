import $ from "../internals/export";
import _cjs_import from "../internals/array-iteration";
import arrayMethodIsStrict from "../internals/array-method-is-strict";
var $every = _cjs_import.every;
var STRICT_METHOD = arrayMethodIsStrict('every');

// `Array.prototype.every` method
// https://tc39.es/ecma262/#sec-array.prototype.every
$({
  target: 'Array',
  proto: true,
  forced: !STRICT_METHOD
}, {
  every: function every(callbackfn /* , thisArg */) {
    return $every(this, callbackfn, arguments.length > 1 ? arguments[1] : undefined);
  }
});
const _cjs_default = {};
export default _cjs_default;
