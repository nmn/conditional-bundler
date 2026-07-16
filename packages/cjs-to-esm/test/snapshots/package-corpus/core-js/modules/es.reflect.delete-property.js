import $ from "../internals/export";
import anObject from "../internals/an-object";
import _cjs_import from "../internals/object-get-own-property-descriptor";
import toPropertyKey from "../internals/to-property-key";
var getOwnPropertyDescriptor = _cjs_import.f;
// `Reflect.deleteProperty` method
// https://tc39.es/ecma262/#sec-reflect.deleteproperty
$({
  target: 'Reflect',
  stat: true
}, {
  deleteProperty: function deleteProperty(target, propertyKey) {
    anObject(target);
    var key = toPropertyKey(propertyKey);
    var descriptor = getOwnPropertyDescriptor(target, key);
    return descriptor && !descriptor.configurable ? false : delete target[key];
  }
});
const _cjs_default = {};
export default _cjs_default;
