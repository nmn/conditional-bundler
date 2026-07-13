import userAgent from "../internals/environment-user-agent";
// https://github.com/zloirock/core-js/issues/280

const _cjs_default = /Version\/10(?:\.\d+){1,2}(?: [\w./]+)?(?: Mobile\/\w+)? Safari\//.test(userAgent);
export default _cjs_default;
