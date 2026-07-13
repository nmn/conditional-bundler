import arrayFromConstructorAndList from "../internals/array-from-constructor-and-list";
import { getTypedArrayConstructor as _getTypedArrayConstructor } from "../internals/array-buffer-view-core";
var getTypedArrayConstructor = _getTypedArrayConstructor;
const _cjs_default = function (instance, list) {
  return arrayFromConstructorAndList(getTypedArrayConstructor(instance), list);
};
export default _cjs_default;
