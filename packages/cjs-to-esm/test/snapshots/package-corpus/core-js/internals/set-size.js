import uncurryThisAccessor from "../internals/function-uncurry-this-accessor";
import SetHelpers from "../internals/set-helpers";
const _cjs_default = uncurryThisAccessor(SetHelpers.proto, 'size', 'get') || function (set) {
  return set.size;
};
export default _cjs_default;
