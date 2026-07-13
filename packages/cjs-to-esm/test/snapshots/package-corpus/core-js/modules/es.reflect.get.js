import $ from "../internals/export";
import call from "../internals/function-call";
import isObject from "../internals/is-object";
import anObject from "../internals/an-object";
import isDataDescriptor from "../internals/is-data-descriptor";
import { f as _f } from "../internals/object-get-own-property-descriptor";
import getPrototypeOf from "../internals/object-get-prototype-of";
import toPropertyKey from "../internals/to-property-key";
// `Reflect.get` method
// https://tc39.es/ecma262/#sec-reflect.get
var $get = function (target, propertyKey, receiver) {
  if (anObject(target) === receiver) return target[propertyKey];
  var descriptor = _f(target, propertyKey);
  if (descriptor) return isDataDescriptor(descriptor) ? descriptor.value : descriptor.get === undefined ? undefined : call(descriptor.get, receiver);
  var prototype = getPrototypeOf(target);
  if (isObject(prototype)) return $get(prototype, propertyKey, receiver);
};
$({
  target: 'Reflect',
  stat: true
}, {
  get: function get(target, propertyKey /* , receiver */) {
    return $get(anObject(target), toPropertyKey(propertyKey), arguments.length < 3 ? target : arguments[2]);
  }
});
const _cjs_default = {};
export default _cjs_default;
