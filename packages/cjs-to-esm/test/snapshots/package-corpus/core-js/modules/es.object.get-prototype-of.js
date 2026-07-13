import $ from "../internals/export";
import fails from "../internals/fails";
import toObject from "../internals/to-object";
import nativeGetPrototypeOf from "../internals/object-get-prototype-of";
import CORRECT_PROTOTYPE_GETTER from "../internals/correct-prototype-getter";
var FAILS_ON_PRIMITIVES = fails(function () {
  nativeGetPrototypeOf(1);
});

// `Object.getPrototypeOf` method
// https://tc39.es/ecma262/#sec-object.getprototypeof
$({
  target: 'Object',
  stat: true,
  forced: FAILS_ON_PRIMITIVES,
  sham: !CORRECT_PROTOTYPE_GETTER
}, {
  getPrototypeOf: function getPrototypeOf(it) {
    return nativeGetPrototypeOf(toObject(it));
  }
});
const _cjs_default = {};
export default _cjs_default;
