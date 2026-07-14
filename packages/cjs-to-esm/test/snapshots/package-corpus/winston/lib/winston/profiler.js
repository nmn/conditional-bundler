import __cjs_dep_0 from "./logger";
const __cjs_process__ = {
  env: {
    NODE_ENV: "production"
  }
};
function __cjs_require__(request) {
  switch (request) {
    case "./logger":
      return __cjs_dep_0;
    default:
      throw new Error("Cannot require " + request + " from winston@3.19.0::lib/winston/profiler.js");
  }
}
const __cjs_cache__ = globalThis.__BUNDLER_CJS_CACHE__ ??= new Map();
let __cjs_default__ = __cjs_cache__.get("winston@3.19.0::lib/winston/profiler.js::env=snapshot::NODE_ENV=production");
if (!__cjs_default__) {
  const __cjs_module__ = {
    exports: {}
  };
  const __cjs_exports__ = __cjs_module__.exports;
  __cjs_cache__.set("winston@3.19.0::lib/winston/profiler.js::env=snapshot::NODE_ENV=production", __cjs_exports__);
  ((module, exports, require, process, __filename, __dirname) => {
    /**
     * profiler.js: TODO: add file header description.
     *
     * (C) 2010 Charlie Robbins
     * MIT LICENCE
     */

    'use strict';

    /**
     * TODO: add class description.
     * @type {Profiler}
     * @private
     */
    class Profiler {
      /**
       * Constructor function for the Profiler instance used by
       * `Logger.prototype.startTimer`. When done is called the timer will finish
       * and log the duration.
       * @param {!Logger} logger - TODO: add param description.
       * @private
       */
      constructor(logger) {
        const Logger = require('./logger');
        if (typeof logger !== 'object' || Array.isArray(logger) || !(logger instanceof Logger)) {
          throw new Error('Logger is required for profiling');
        } else {
          this.logger = logger;
          this.start = Date.now();
        }
      }

      /**
       * Ends the current timer (i.e. Profiler) instance and logs the `msg` along
       * with the duration since creation.
       * @returns {mixed} - TODO: add return description.
       * @private
       */
      done(...args) {
        if (typeof args[args.length - 1] === 'function') {
          // eslint-disable-next-line no-console
          console.warn('Callback function no longer supported as of winston@3.0.0');
          args.pop();
        }
        const info = typeof args[args.length - 1] === 'object' ? args.pop() : {};
        info.level = info.level || 'info';
        info.durationMs = Date.now() - this.start;
        return this.logger.write(info);
      }
    }
    module.exports = Profiler;
  })(__cjs_module__, __cjs_exports__, __cjs_require__, __cjs_process__, "winston@3.19.0::lib/winston/profiler.js", "winston@3.19.0::lib/winston");
  __cjs_default__ = __cjs_module__.exports;
  __cjs_cache__.set("winston@3.19.0::lib/winston/profiler.js::env=snapshot::NODE_ENV=production", __cjs_default__);
}
export default __cjs_default__;
