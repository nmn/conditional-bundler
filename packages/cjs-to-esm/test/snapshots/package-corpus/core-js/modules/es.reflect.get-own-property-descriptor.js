import $ from "../internals/export";
import DESCRIPTORS from "../internals/descriptors";
import anObject from "../internals/an-object";
import getOwnPropertyDescriptorModule from "../internals/object-get-own-property-descriptor";
// `Reflect.getOwnPropertyDescriptor` method
// https://tc39.es/ecma262/#sec-reflect.getownpropertydescriptor
$({
  target: 'Reflect',
  stat: true,
  sham: !DESCRIPTORS
}, {
  getOwnPropertyDescriptor: function getOwnPropertyDescriptor(target, propertyKey) {
    return getOwnPropertyDescriptorModule.f(anObject(target), propertyKey);
  }
});
const _cjs_default = {};
export default _cjs_default;
