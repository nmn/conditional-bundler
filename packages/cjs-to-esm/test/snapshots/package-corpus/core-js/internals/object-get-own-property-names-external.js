import classof from "../internals/classof-raw";
import toIndexedObject from "../internals/to-indexed-object";
import { f as _f } from "../internals/object-get-own-property-names";
import arraySlice from "../internals/array-slice";
/* eslint-disable es/no-object-getownpropertynames -- safe */

var $getOwnPropertyNames = _f;
var windowNames = typeof window == 'object' && window && Object.getOwnPropertyNames ? Object.getOwnPropertyNames(window) : [];
var getWindowNames = function (it) {
  try {
    return $getOwnPropertyNames(it);
  } catch (error) {
    return arraySlice(windowNames);
  }
};

// fallback for IE11 buggy Object.getOwnPropertyNames with iframe and window
const _f2 = function getOwnPropertyNames(it) {
  return windowNames && classof(it) === 'Window' ? getWindowNames(it) : $getOwnPropertyNames(toIndexedObject(it));
};
export { _f2 as f };
const _cjs_default = {
  ["f"]: _f2
};
export default _cjs_default;
