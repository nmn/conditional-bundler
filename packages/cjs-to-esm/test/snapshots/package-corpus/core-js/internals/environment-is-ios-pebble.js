import userAgent from "../internals/environment-user-agent";
const _cjs_default = /ipad|iphone|ipod/i.test(userAgent) && typeof Pebble != 'undefined';
export default _cjs_default;
