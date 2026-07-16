import arrayFromConstructorAndList from "../internals/array-from-constructor-and-list";
import _cjs_import from "../internals/array-buffer-view-core";
var getTypedArrayConstructor = _cjs_import.getTypedArrayConstructor;
const _cjs_default = function (instance, list) {
  return arrayFromConstructorAndList(getTypedArrayConstructor(instance), list);
};
export default _cjs_default;
