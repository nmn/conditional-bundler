import DESCRIPTORS from "../internals/descriptors";
import defineBuiltInAccessor from "../internals/define-built-in-accessor";
import isObject from "../internals/is-object";
import isPossiblePrototype from "../internals/is-possible-prototype";
import toObject from "../internals/to-object";
import requireObjectCoercible from "../internals/require-object-coercible";
// eslint-disable-next-line es/no-object-getprototypeof -- safe
var getPrototypeOf = Object.getPrototypeOf;
// eslint-disable-next-line es/no-object-setprototypeof -- safe
var setPrototypeOf = Object.setPrototypeOf;
var ObjectPrototype = Object.prototype;
var PROTO = '__proto__';

// `Object.prototype.__proto__` accessor
// https://tc39.es/ecma262/#sec-object.prototype.__proto__
if (DESCRIPTORS && getPrototypeOf && setPrototypeOf && !(PROTO in ObjectPrototype)) try {
  defineBuiltInAccessor(ObjectPrototype, PROTO, {
    configurable: true,
    get: function __proto__() {
      return getPrototypeOf(toObject(this));
    },
    set: function __proto__(proto) {
      var O = requireObjectCoercible(this);
      if (isPossiblePrototype(proto) && isObject(O)) {
        setPrototypeOf(O, proto);
      }
    }
  });
} catch (error) {/* empty */}
const _cjs_default = {};
export default _cjs_default;
