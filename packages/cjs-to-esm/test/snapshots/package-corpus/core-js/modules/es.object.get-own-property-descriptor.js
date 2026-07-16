import $ from "../internals/export";
import fails from "../internals/fails";
import toIndexedObject from "../internals/to-indexed-object";
import _cjs_import from "../internals/object-get-own-property-descriptor";
import DESCRIPTORS from "../internals/descriptors";
var nativeGetOwnPropertyDescriptor = _cjs_import.f;
var FORCED = !DESCRIPTORS || fails(function () {
  nativeGetOwnPropertyDescriptor(1);
});

// `Object.getOwnPropertyDescriptor` method
// https://tc39.es/ecma262/#sec-object.getownpropertydescriptor
$({
  target: 'Object',
  stat: true,
  forced: FORCED,
  sham: !DESCRIPTORS
}, {
  getOwnPropertyDescriptor: function getOwnPropertyDescriptor(it, key) {
    return nativeGetOwnPropertyDescriptor(toIndexedObject(it), key);
  }
});
const _cjs_default = {};
export default _cjs_default;
