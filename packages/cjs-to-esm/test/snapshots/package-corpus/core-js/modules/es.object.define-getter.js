import $ from "../internals/export";
import DESCRIPTORS from "../internals/descriptors";
import FORCED from "../internals/object-prototype-accessors-forced";
import aCallable from "../internals/a-callable";
import toObject from "../internals/to-object";
import definePropertyModule from "../internals/object-define-property";
// `Object.prototype.__defineGetter__` method
// https://tc39.es/ecma262/#sec-object.prototype.__defineGetter__
if (DESCRIPTORS) {
  $({
    target: 'Object',
    proto: true,
    forced: FORCED
  }, {
    __defineGetter__: function __defineGetter__(P, getter) {
      definePropertyModule.f(toObject(this), P, {
        get: aCallable(getter),
        enumerable: true,
        configurable: true
      });
    }
  });
}
const _cjs_default = {};
export default _cjs_default;
