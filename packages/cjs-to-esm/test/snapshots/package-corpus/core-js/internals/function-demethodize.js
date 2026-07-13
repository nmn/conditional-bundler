import uncurryThis from "../internals/function-uncurry-this";
import aCallable from "../internals/a-callable";
const _cjs_default = function demethodize() {
  return uncurryThis(aCallable(this));
};
export default _cjs_default;
