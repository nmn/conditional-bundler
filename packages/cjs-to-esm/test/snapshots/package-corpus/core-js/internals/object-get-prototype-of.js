import hasOwn from "../internals/has-own-property";
import isCallable from "../internals/is-callable";
import toObject from "../internals/to-object";
import sharedKey from "../internals/shared-key";
import CORRECT_PROTOTYPE_GETTER from "../internals/correct-prototype-getter";
var IE_PROTO = sharedKey('IE_PROTO');
var $Object = Object;
var ObjectPrototype = $Object.prototype;

// `Object.getPrototypeOf` method
// https://tc39.es/ecma262/#sec-object.getprototypeof
// eslint-disable-next-line es/no-object-getprototypeof -- safe
const _cjs_default = CORRECT_PROTOTYPE_GETTER ? $Object.getPrototypeOf : function (O) {
  var object = toObject(O);
  if (hasOwn(object, IE_PROTO)) return object[IE_PROTO];
  var constructor = object.constructor;
  if (isCallable(constructor) && object instanceof constructor) {
    return constructor.prototype;
  }
  return object instanceof $Object ? ObjectPrototype : null;
};
export default _cjs_default;
