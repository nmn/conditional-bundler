import $ from "../internals/export";
import DESCRIPTORS from "../internals/descriptors";
import FORCED from "../internals/object-prototype-accessors-forced";
import toObject from "../internals/to-object";
import toPropertyKey from "../internals/to-property-key";
import getPrototypeOf from "../internals/object-get-prototype-of";
import { f as _f } from "../internals/object-get-own-property-descriptor";
var getOwnPropertyDescriptor = _f;

// `Object.prototype.__lookupGetter__` method
// https://tc39.es/ecma262/#sec-object.prototype.__lookupGetter__
if (DESCRIPTORS) {
  $({
    target: 'Object',
    proto: true,
    forced: FORCED
  }, {
    __lookupGetter__: function __lookupGetter__(P) {
      var O = toObject(this);
      var key = toPropertyKey(P);
      var desc;
      do {
        if (desc = getOwnPropertyDescriptor(O, key)) return desc.get;
      } while (O = getPrototypeOf(O));
    }
  });
}
const _cjs_default = {};
export default _cjs_default;
