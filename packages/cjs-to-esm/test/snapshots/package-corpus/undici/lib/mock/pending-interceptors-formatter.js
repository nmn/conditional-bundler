import * as __cjs_dep_0 from "node:stream";
import * as __cjs_dep_1 from "node:console";
const __cjs_process__ = {
  env: {
    NODE_ENV: "production"
  }
};
function __cjs_require__(request) {
  switch (request) {
    case "node:stream":
      return __cjs_dep_0;
    case "node:console":
      return __cjs_dep_1;
    default:
      throw new Error("Cannot require " + request + " from undici@8.7.0::lib/mock/pending-interceptors-formatter.js");
  }
}
const __cjs_cache__ = globalThis.__BUNDLER_CJS_CACHE__ ??= new Map();
let __cjs_default__ = __cjs_cache__.get("undici@8.7.0::lib/mock/pending-interceptors-formatter.js::env=snapshot::NODE_ENV=production");
if (!__cjs_default__) {
  const __cjs_module__ = {
    exports: {}
  };
  const __cjs_exports__ = __cjs_module__.exports;
  __cjs_cache__.set("undici@8.7.0::lib/mock/pending-interceptors-formatter.js::env=snapshot::NODE_ENV=production", __cjs_exports__);
  ((module, exports, require, process, __filename, __dirname) => {
    'use strict';

    const {
      Transform
    } = require('node:stream');
    const {
      Console
    } = require('node:console');
    const PERSISTENT = process.versions.icu ? '✅' : 'Y ';
    const NOT_PERSISTENT = process.versions.icu ? '❌' : 'N ';

    /**
     * Gets the output of `console.table(…)` as a string.
     */
    module.exports = class PendingInterceptorsFormatter {
      constructor({
        disableColors
      } = {}) {
        this.transform = new Transform({
          transform(chunk, _enc, cb) {
            cb(null, chunk);
          }
        });
        this.logger = new Console({
          stdout: this.transform,
          inspectOptions: {
            colors: !disableColors && !process.env.CI
          }
        });
      }
      format(pendingInterceptors) {
        const withPrettyHeaders = pendingInterceptors.map(({
          method,
          path,
          data: {
            statusCode
          },
          persist,
          times,
          timesInvoked,
          origin
        }) => ({
          Method: method,
          Origin: origin,
          Path: path,
          'Status code': statusCode,
          Persistent: persist ? PERSISTENT : NOT_PERSISTENT,
          Invocations: timesInvoked,
          Remaining: persist ? Infinity : times - timesInvoked
        }));
        this.logger.table(withPrettyHeaders);
        return this.transform.read().toString();
      }
    };
  })(__cjs_module__, __cjs_exports__, __cjs_require__, __cjs_process__, "undici@8.7.0::lib/mock/pending-interceptors-formatter.js", "undici@8.7.0::lib/mock");
  __cjs_default__ = __cjs_module__.exports;
  __cjs_cache__.set("undici@8.7.0::lib/mock/pending-interceptors-formatter.js::env=snapshot::NODE_ENV=production", __cjs_default__);
}
export default __cjs_default__;
