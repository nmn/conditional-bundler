import DESCRIPTORS from "../internals/descriptors";
import definePropertyModule from "../internals/object-define-property";
import createPropertyDescriptor from "../internals/create-property-descriptor";
const _cjs_default = DESCRIPTORS ? function (object, key, value) {
  return definePropertyModule.f(object, key, createPropertyDescriptor(1, value));
} : function (object, key, value) {
  object[key] = value;
  return object;
};
export default _cjs_default;
