import uncurryThis from "../internals/function-uncurry-this";
import aCallable from "../internals/a-callable";
const _cjs_default = function (object, key, method) {
  try {
    // eslint-disable-next-line es/no-object-getownpropertydescriptor -- safe
    return uncurryThis(aCallable(Object.getOwnPropertyDescriptor(object, key)[method]));
  } catch (error) {/* empty */}
};
export default _cjs_default;
