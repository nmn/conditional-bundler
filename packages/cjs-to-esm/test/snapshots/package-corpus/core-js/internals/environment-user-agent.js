import globalThis from "../internals/global-this";
var navigator = globalThis.navigator;
var userAgent = navigator && navigator.userAgent;
const _cjs_default = userAgent ? String(userAgent) : '';
export default _cjs_default;
