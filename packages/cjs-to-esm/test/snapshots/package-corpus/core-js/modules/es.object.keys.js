import $ from "../internals/export";
import toObject from "../internals/to-object";
import nativeKeys from "../internals/object-keys";
import fails from "../internals/fails";
var FAILS_ON_PRIMITIVES = fails(function () {
  nativeKeys(1);
});

// `Object.keys` method
// https://tc39.es/ecma262/#sec-object.keys
$({
  target: 'Object',
  stat: true,
  forced: FAILS_ON_PRIMITIVES
}, {
  keys: function keys(it) {
    return nativeKeys(toObject(it));
  }
});
const _cjs_default = {};
export default _cjs_default;
