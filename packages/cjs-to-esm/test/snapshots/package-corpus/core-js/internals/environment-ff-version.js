import userAgent from "../internals/environment-user-agent";
var firefox = userAgent.match(/firefox\/(\d+)/i);
const _cjs_default = !!firefox && +firefox[1];
export default _cjs_default;
