import $ from "../internals/export";
import DESCRIPTORS from "../internals/descriptors";
import anObject from "../internals/an-object";
import toPropertyKey from "../internals/to-property-key";
import { f as _f } from "../internals/object-define-property";
import isCallable from "../internals/is-callable";
import fails from "../internals/fails";
var $TypeError = TypeError;

// MS Edge has broken Reflect.defineProperty - throwing instead of returning false
var ERROR_INSTEAD_OF_FALSE = fails(function () {
  // eslint-disable-next-line es/no-reflect -- required for testing
  Reflect.defineProperty(_f({}, 1, {
    value: 1
  }), 1, {
    value: 2
  });
});

// `Reflect.defineProperty` method
// https://tc39.es/ecma262/#sec-reflect.defineproperty
$({
  target: 'Reflect',
  stat: true,
  forced: ERROR_INSTEAD_OF_FALSE,
  sham: !DESCRIPTORS
}, {
  defineProperty: function defineProperty(target, propertyKey, attributes) {
    anObject(target);
    var key = toPropertyKey(propertyKey);
    var get, set;
    anObject(attributes);
    // propagate `ToPropertyDescriptor` errors instead of catching them
    if (('get' in attributes || 'set' in attributes) && ('get' in attributes && !isCallable(get = attributes.get) && get !== undefined || 'set' in attributes && !isCallable(set = attributes.set) && set !== undefined || 'value' in attributes || 'writable' in attributes)) throw new $TypeError('Invalid property descriptor');
    try {
      _f(target, key, attributes);
      return true;
    } catch (error) {
      return false;
    }
  }
});
const _cjs_default = {};
export default _cjs_default;
