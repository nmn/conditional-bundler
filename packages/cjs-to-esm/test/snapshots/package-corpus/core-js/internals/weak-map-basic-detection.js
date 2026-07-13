import globalThis from "../internals/global-this";
import isCallable from "../internals/is-callable";
var WeakMap = globalThis.WeakMap;
const _cjs_default = isCallable(WeakMap) && /native code/.test(String(WeakMap));
export default _cjs_default;
