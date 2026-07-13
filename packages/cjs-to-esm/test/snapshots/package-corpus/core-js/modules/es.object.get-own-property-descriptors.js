import $ from "../internals/export";
import DESCRIPTORS from "../internals/descriptors";
import ownKeys from "../internals/own-keys";
import toIndexedObject from "../internals/to-indexed-object";
import { f as _f } from "../internals/object-get-own-property-descriptor";
import createProperty from "../internals/create-property";
// `Object.getOwnPropertyDescriptors` method
// https://tc39.es/ecma262/#sec-object.getownpropertydescriptors
$({
  target: 'Object',
  stat: true,
  sham: !DESCRIPTORS
}, {
  getOwnPropertyDescriptors: function getOwnPropertyDescriptors(object) {
    var O = toIndexedObject(object);
    var getOwnPropertyDescriptor = _f;
    var keys = ownKeys(O);
    var result = {};
    var index = 0;
    var key, descriptor;
    while (keys.length > index) {
      descriptor = getOwnPropertyDescriptor(O, key = keys[index++]);
      if (descriptor !== undefined) createProperty(result, key, descriptor);
    }
    return result;
  }
});
const _cjs_default = {};
export default _cjs_default;
