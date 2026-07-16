import DESCRIPTORS from "../internals/descriptors";
import V8_PROTOTYPE_DEFINE_BUG from "../internals/v8-prototype-define-bug";
import definePropertyModule from "../internals/object-define-property";
import anObject from "../internals/an-object";
import toIndexedObject from "../internals/to-indexed-object";
import objectKeys from "../internals/object-keys";
// `Object.defineProperties` method
// https://tc39.es/ecma262/#sec-object.defineproperties
// eslint-disable-next-line es/no-object-defineproperties -- safe
const _f = DESCRIPTORS && !V8_PROTOTYPE_DEFINE_BUG ? Object.defineProperties : function defineProperties(O, Properties) {
  anObject(O);
  var props = toIndexedObject(Properties);
  var keys = objectKeys(Properties);
  var length = keys.length;
  var index = 0;
  var key;
  while (length > index) definePropertyModule.f(O, key = keys[index++], props[key]);
  return O;
};
export { _f as f };
const _cjs_default = {
  ["f"]: _f
};
export default _cjs_default;
