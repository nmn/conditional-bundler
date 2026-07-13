import uncurryThis from "../internals/function-uncurry-this";
import hasOwn from "../internals/has-own-property";
import toIndexedObject from "../internals/to-indexed-object";
import { indexOf as _indexOf } from "../internals/array-includes";
import hiddenKeys from "../internals/hidden-keys";
var indexOf = _indexOf;
var push = uncurryThis([].push);
const _cjs_default = function (object, names) {
  var O = toIndexedObject(object);
  var i = 0;
  var result = [];
  var key;
  for (key in O) !hasOwn(hiddenKeys, key) && hasOwn(O, key) && push(result, key);
  // Don't enum bug & hidden keys
  while (names.length > i) if (hasOwn(O, key = names[i++])) {
    ~indexOf(result, key) || push(result, key);
  }
  return result;
};
export default _cjs_default;
