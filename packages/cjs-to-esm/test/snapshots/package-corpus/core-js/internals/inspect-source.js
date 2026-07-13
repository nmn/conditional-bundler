import uncurryThis from "../internals/function-uncurry-this";
import isCallable from "../internals/is-callable";
import store from "../internals/shared-store";
var functionToString = uncurryThis(Function.toString);

// this helper broken in `core-js@3.4.1-3.4.4`, so we can't use `shared` helper
if (!isCallable(store.inspectSource)) {
  store.inspectSource = function (it) {
    return functionToString(it);
  };
}
const _cjs_default = store.inspectSource;
export default _cjs_default;
