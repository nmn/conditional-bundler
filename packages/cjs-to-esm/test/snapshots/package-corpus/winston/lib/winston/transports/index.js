import __cjs_dep_0 from "./console";
import __cjs_dep_1 from "./file";
import __cjs_dep_2 from "./http";
import __cjs_dep_3 from "./stream";
const __cjs_process__ = {
  env: {
    NODE_ENV: "production"
  }
};
function __cjs_require__(request) {
  switch (request) {
    case "./console":
      return __cjs_dep_0;
    case "./file":
      return __cjs_dep_1;
    case "./http":
      return __cjs_dep_2;
    case "./stream":
      return __cjs_dep_3;
    default:
      throw new Error("Cannot require " + request + " from winston@3.19.0/lib/winston/transports/index.js");
  }
}
const __cjs_cache__ = globalThis.__BUNDLER_CJS_CACHE__ ??= new Map();
let __cjs_default__ = __cjs_cache__.get("winston@3.19.0/lib/winston/transports/index.js");
if (!__cjs_default__) {
  const __cjs_module__ = {
    exports: {}
  };
  const __cjs_exports__ = __cjs_module__.exports;
  __cjs_cache__.set("winston@3.19.0/lib/winston/transports/index.js", __cjs_exports__);
  ((module, exports, require, process) => {
    /**
     * transports.js: Set of all transports Winston knows about.
     *
     * (C) 2010 Charlie Robbins
     * MIT LICENCE
     */

    'use strict';

    /**
     * TODO: add property description.
     * @type {Console}
     */
    Object.defineProperty(exports, 'Console', {
      configurable: true,
      enumerable: true,
      get() {
        return require('./console');
      }
    });

    /**
     * TODO: add property description.
     * @type {File}
     */
    Object.defineProperty(exports, 'File', {
      configurable: true,
      enumerable: true,
      get() {
        return require('./file');
      }
    });

    /**
     * TODO: add property description.
     * @type {Http}
     */
    Object.defineProperty(exports, 'Http', {
      configurable: true,
      enumerable: true,
      get() {
        return require('./http');
      }
    });

    /**
     * TODO: add property description.
     * @type {Stream}
     */
    Object.defineProperty(exports, 'Stream', {
      configurable: true,
      enumerable: true,
      get() {
        return require('./stream');
      }
    });
  })(__cjs_module__, __cjs_exports__, __cjs_require__, __cjs_process__);
  __cjs_default__ = __cjs_module__.exports;
  __cjs_cache__.set("winston@3.19.0/lib/winston/transports/index.js", __cjs_default__);
}
export default __cjs_default__;
export const Console = __cjs_default__["Console"];
export const File = __cjs_default__["File"];
export const Http = __cjs_default__["Http"];
export const Stream = __cjs_default__["Stream"];
