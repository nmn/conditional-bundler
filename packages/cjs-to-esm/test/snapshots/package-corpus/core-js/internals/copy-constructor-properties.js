import hasOwn from "../internals/has-own-property";
import ownKeys from "../internals/own-keys";
import getOwnPropertyDescriptorModule from "../internals/object-get-own-property-descriptor";
import definePropertyModule from "../internals/object-define-property";
const _cjs_default = function (target, source, exceptions) {
  var keys = ownKeys(source);
  var defineProperty = definePropertyModule.f;
  var getOwnPropertyDescriptor = getOwnPropertyDescriptorModule.f;
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (!hasOwn(target, key) && !(exceptions && hasOwn(exceptions, key))) {
      defineProperty(target, key, getOwnPropertyDescriptor(source, key));
    }
  }
};
export default _cjs_default;
