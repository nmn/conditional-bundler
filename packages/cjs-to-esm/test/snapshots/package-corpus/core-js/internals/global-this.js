const __cjs_process__ = {
  env: {
    NODE_ENV: "production"
  }
};
function __cjs_require__(request) {
  switch (request) {
    default:
      throw new Error("Cannot require " + request + " from core-js@3.49.0::internals/global-this.js");
  }
}
const __cjs_cache__ = globalThis.__BUNDLER_CJS_CACHE__ ??= new Map();
let __cjs_default__ = __cjs_cache__.get("core-js@3.49.0::internals/global-this.js::NODE_ENV=production");
if (!__cjs_default__) {
  const __cjs_module__ = {
    exports: {}
  };
  const __cjs_exports__ = __cjs_module__.exports;
  __cjs_cache__.set("core-js@3.49.0::internals/global-this.js::NODE_ENV=production", __cjs_exports__);
  ((module, exports, require, process, __filename, __dirname) => {
    'use strict';

    var check = function (it) {
      return it && it.Math === Math && it;
    };

    // https://github.com/zloirock/core-js/issues/86#issuecomment-115759028
    module.exports =
    // eslint-disable-next-line es/no-global-this -- safe
    check(typeof globalThis == 'object' && globalThis) || check(typeof window == 'object' && window) ||
    // eslint-disable-next-line no-restricted-globals -- safe
    check(typeof self == 'object' && self) || check(typeof global == 'object' && global) || check(typeof this == 'object' && this) ||
    // eslint-disable-next-line no-new-func -- fallback
    function () {
      return this;
    }() || Function('return this')();
  })(__cjs_module__, __cjs_exports__, __cjs_require__, __cjs_process__, "core-js@3.49.0::internals/global-this.js", "core-js@3.49.0::internals");
  __cjs_default__ = __cjs_module__.exports;
  __cjs_cache__.set("core-js@3.49.0::internals/global-this.js::NODE_ENV=production", __cjs_default__);
}
export default __cjs_default__;
