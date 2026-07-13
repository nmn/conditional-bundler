import userAgent from "../internals/environment-user-agent";
var webkit = userAgent.match(/AppleWebKit\/(\d+)\./);
const _cjs_default = !!webkit && +webkit[1];
export default _cjs_default;
