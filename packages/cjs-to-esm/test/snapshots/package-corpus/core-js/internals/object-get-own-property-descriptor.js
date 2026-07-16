import DESCRIPTORS from "../internals/descriptors";
import call from "../internals/function-call";
import propertyIsEnumerableModule from "../internals/object-property-is-enumerable";
import createPropertyDescriptor from "../internals/create-property-descriptor";
import toIndexedObject from "../internals/to-indexed-object";
import toPropertyKey from "../internals/to-property-key";
import hasOwn from "../internals/has-own-property";
import IE8_DOM_DEFINE from "../internals/ie8-dom-define";
// eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
var $getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;

// `Object.getOwnPropertyDescriptor` method
// https://tc39.es/ecma262/#sec-object.getownpropertydescriptor
const _f = DESCRIPTORS ? $getOwnPropertyDescriptor : function getOwnPropertyDescriptor(O, P) {
  O = toIndexedObject(O);
  P = toPropertyKey(P);
  if (IE8_DOM_DEFINE) try {
    return $getOwnPropertyDescriptor(O, P);
  } catch (error) {/* empty */}
  if (hasOwn(O, P)) return createPropertyDescriptor(!call(propertyIsEnumerableModule.f, O, P), O[P]);
};
export { _f as f };
const _cjs_default = {
  ["f"]: _f
};
export default _cjs_default;
