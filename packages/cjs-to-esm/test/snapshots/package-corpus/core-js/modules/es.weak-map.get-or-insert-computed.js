import $ from "../internals/export";
import aCallable from "../internals/a-callable";
import aWeakMap from "../internals/a-weak-map";
import aWeakKey from "../internals/a-weak-key";
import { get as _get, has as _has, set as _set } from "../internals/weak-map-helpers";
import IS_PURE from "../internals/is-pure";
var get = _get;
var has = _has;
var set = _set;
var FORCED = IS_PURE || !function () {
  try {
    // eslint-disable-next-line es/no-weak-map, no-throw-literal -- testing
    if (WeakMap.prototype.getOrInsertComputed) new WeakMap().getOrInsertComputed(1, function () {
      throw 1;
    });
  } catch (error) {
    // FF144 Nightly - Beta 3 bug
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1988369
    return error instanceof TypeError;
  }
}();

// `WeakMap.prototype.getOrInsertComputed` method
// https://tc39.es/ecma262/#sec-weakmap.prototype.getorinsertcomputed
$({
  target: 'WeakMap',
  proto: true,
  real: true,
  forced: FORCED
}, {
  getOrInsertComputed: function getOrInsertComputed(key, callbackfn) {
    if (!IS_PURE) aWeakMap(this);
    aWeakKey(key);
    aCallable(callbackfn);
    if (has(this, key)) return get(this, key);
    var value = callbackfn(key);
    set(this, key, value);
    return value;
  }
});
const _cjs_default = {};
export default _cjs_default;
