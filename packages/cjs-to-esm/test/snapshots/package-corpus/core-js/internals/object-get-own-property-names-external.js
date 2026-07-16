import classof from "../internals/classof-raw";
import toIndexedObject from "../internals/to-indexed-object";
import _cjs_import from "../internals/object-get-own-property-names";
import arraySlice from "../internals/array-slice";
/* eslint-disable es/no-object-getownpropertynames -- safe */

var $getOwnPropertyNames = _cjs_import.f;
var windowNames = typeof window == 'object' && window && Object.getOwnPropertyNames ? Object.getOwnPropertyNames(window) : [];
var getWindowNames = function (it) {
  try {
    return $getOwnPropertyNames(it);
  } catch (error) {
    return arraySlice(windowNames);
  }
};

// fallback for IE11 buggy Object.getOwnPropertyNames with iframe and window
const _f = function getOwnPropertyNames(it) {
  return windowNames && classof(it) === 'Window' ? getWindowNames(it) : $getOwnPropertyNames(toIndexedObject(it));
};
export { _f as f };
const _cjs_default = {
  ["f"]: _f
};
export default _cjs_default;
