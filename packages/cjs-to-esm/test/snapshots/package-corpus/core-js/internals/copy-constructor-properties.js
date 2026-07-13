import hasOwn from "../internals/has-own-property";
import ownKeys from "../internals/own-keys";
import { f as _f } from "../internals/object-get-own-property-descriptor";
import { f as _f2 } from "../internals/object-define-property";
const _cjs_default = function (target, source, exceptions) {
  var keys = ownKeys(source);
  var defineProperty = _f2;
  var getOwnPropertyDescriptor = _f;
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (!hasOwn(target, key) && !(exceptions && hasOwn(exceptions, key))) {
      defineProperty(target, key, getOwnPropertyDescriptor(source, key));
    }
  }
};
export default _cjs_default;
