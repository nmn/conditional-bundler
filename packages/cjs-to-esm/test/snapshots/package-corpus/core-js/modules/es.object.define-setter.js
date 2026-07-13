import $ from "../internals/export";
import DESCRIPTORS from "../internals/descriptors";
import FORCED from "../internals/object-prototype-accessors-forced";
import aCallable from "../internals/a-callable";
import toObject from "../internals/to-object";
import { f as _f } from "../internals/object-define-property";
// `Object.prototype.__defineSetter__` method
// https://tc39.es/ecma262/#sec-object.prototype.__defineSetter__
if (DESCRIPTORS) {
  $({
    target: 'Object',
    proto: true,
    forced: FORCED
  }, {
    __defineSetter__: function __defineSetter__(P, setter) {
      _f(toObject(this), P, {
        set: aCallable(setter),
        enumerable: true,
        configurable: true
      });
    }
  });
}
const _cjs_default = {};
export default _cjs_default;
