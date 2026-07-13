import makeBuiltIn from "../internals/make-built-in";
import { f as _f } from "../internals/object-define-property";
const _cjs_default = function (target, name, descriptor) {
  if (descriptor.get) makeBuiltIn(descriptor.get, name, {
    getter: true
  });
  if (descriptor.set) makeBuiltIn(descriptor.set, name, {
    setter: true
  });
  return _f(target, name, descriptor);
};
export default _cjs_default;
