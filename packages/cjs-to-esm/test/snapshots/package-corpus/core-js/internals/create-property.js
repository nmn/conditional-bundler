import DESCRIPTORS from "../internals/descriptors";
import definePropertyModule from "../internals/object-define-property";
import createPropertyDescriptor from "../internals/create-property-descriptor";
const _cjs_default = function (object, key, value) {
  if (DESCRIPTORS) definePropertyModule.f(object, key, createPropertyDescriptor(0, value));else object[key] = value;
};
export default _cjs_default;
