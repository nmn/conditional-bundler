import $ from "../internals/export";
import _cjs_import from "../internals/array-reduce";
import arrayMethodIsStrict from "../internals/array-method-is-strict";
import CHROME_VERSION from "../internals/environment-v8-version";
import IS_NODE from "../internals/environment-is-node";
var $reduce = _cjs_import.left;
// Chrome 80-82 has a critical bug
// https://bugs.chromium.org/p/chromium/issues/detail?id=1049982
var CHROME_BUG = !IS_NODE && CHROME_VERSION > 79 && CHROME_VERSION < 83;
var FORCED = CHROME_BUG || !arrayMethodIsStrict('reduce');

// `Array.prototype.reduce` method
// https://tc39.es/ecma262/#sec-array.prototype.reduce
$({
  target: 'Array',
  proto: true,
  forced: FORCED
}, {
  reduce: function reduce(callbackfn /* , initialValue */) {
    var length = arguments.length;
    return $reduce(this, callbackfn, length, length > 1 ? arguments[1] : undefined);
  }
});
const _cjs_default = {};
export default _cjs_default;
