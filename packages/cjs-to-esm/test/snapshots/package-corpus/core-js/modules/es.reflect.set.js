import $ from "../internals/export";
import call from "../internals/function-call";
import anObject from "../internals/an-object";
import isObject from "../internals/is-object";
import isDataDescriptor from "../internals/is-data-descriptor";
import fails from "../internals/fails";
import definePropertyModule from "../internals/object-define-property";
import getOwnPropertyDescriptorModule from "../internals/object-get-own-property-descriptor";
import getPrototypeOf from "../internals/object-get-prototype-of";
import createPropertyDescriptor from "../internals/create-property-descriptor";
import toPropertyKey from "../internals/to-property-key";
// `Reflect.set` method
// https://tc39.es/ecma262/#sec-reflect.set
var $set = function (target, propertyKey, V, receiver) {
  var ownDescriptor = getOwnPropertyDescriptorModule.f(anObject(target), propertyKey);
  var existingDescriptor, prototype, setter;
  if (!ownDescriptor) {
    if (isObject(prototype = getPrototypeOf(target))) {
      return $set(prototype, propertyKey, V, receiver);
    }
    ownDescriptor = createPropertyDescriptor(0);
  }
  if (isDataDescriptor(ownDescriptor)) {
    if (ownDescriptor.writable === false || !isObject(receiver)) return false;
    if (existingDescriptor = getOwnPropertyDescriptorModule.f(receiver, propertyKey)) {
      if (!isDataDescriptor(existingDescriptor) || existingDescriptor.writable === false) return false;
      definePropertyModule.f(receiver, propertyKey, {
        value: V
      });
    } else try {
      definePropertyModule.f(receiver, propertyKey, createPropertyDescriptor(0, V));
    } catch (error) {
      return false;
    }
  } else {
    setter = ownDescriptor.set;
    if (setter === undefined) return false;
    call(setter, receiver, V);
  }
  return true;
};

// MS Edge 17-18 Reflect.set allows setting the property to object
// with non-writable property on the prototype
var MS_EDGE_BUG = fails(function () {
  var Constructor = function () {/* empty */};
  var object = definePropertyModule.f(new Constructor(), 'a', {
    configurable: true
  });
  // eslint-disable-next-line es/no-reflect -- required for testing
  return Reflect.set(Constructor.prototype, 'a', 1, object) !== false;
});
$({
  target: 'Reflect',
  stat: true,
  forced: MS_EDGE_BUG
}, {
  set: function set(target, propertyKey, V /* , receiver */) {
    return $set(anObject(target), toPropertyKey(propertyKey), V, arguments.length < 4 ? target : arguments[3]);
  }
});
const _cjs_default = {};
export default _cjs_default;
