import globalThis from "../internals/global-this";
import uncurryThis from "../internals/function-uncurry-this";
const _cjs_default = function (CONSTRUCTOR, METHOD) {
  return uncurryThis(globalThis[CONSTRUCTOR].prototype[METHOD]);
};
export default _cjs_default;
