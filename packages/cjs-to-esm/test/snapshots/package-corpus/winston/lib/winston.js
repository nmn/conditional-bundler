import __cjs_dep_0 from "logform";
import __cjs_dep_1 from "./winston/common";
import __cjs_dep_2 from "../package.json";
import __cjs_dep_3 from "./winston/transports";
import __cjs_dep_4 from "./winston/config";
import __cjs_dep_5 from "./winston/create-logger";
import __cjs_dep_6 from "./winston/logger";
import __cjs_dep_7 from "./winston/exception-handler";
import __cjs_dep_8 from "./winston/rejection-handler";
import __cjs_dep_9 from "./winston/container";
import __cjs_dep_10 from "winston-transport";
const __cjs_process__ = {
  env: {
    NODE_ENV: "production"
  }
};
function __cjs_require__(request) {
  switch (request) {
    case "logform":
      return __cjs_dep_0;
    case "./winston/common":
      return __cjs_dep_1;
    case "../package.json":
      return __cjs_dep_2;
    case "./winston/transports":
      return __cjs_dep_3;
    case "./winston/config":
      return __cjs_dep_4;
    case "./winston/create-logger":
      return __cjs_dep_5;
    case "./winston/logger":
      return __cjs_dep_6;
    case "./winston/exception-handler":
      return __cjs_dep_7;
    case "./winston/rejection-handler":
      return __cjs_dep_8;
    case "./winston/container":
      return __cjs_dep_9;
    case "winston-transport":
      return __cjs_dep_10;
    default:
      throw new Error("Cannot require " + request + " from winston@3.19.0::lib/winston.js");
  }
}
const __cjs_cache__ = globalThis.__BUNDLER_CJS_CACHE__ ??= new Map();
let __cjs_default__ = __cjs_cache__.get("winston@3.19.0::lib/winston.js::NODE_ENV=production");
if (!__cjs_default__) {
  const __cjs_module__ = {
    exports: {}
  };
  const __cjs_exports__ = __cjs_module__.exports;
  __cjs_cache__.set("winston@3.19.0::lib/winston.js::NODE_ENV=production", __cjs_exports__);
  ((module, exports, require, process, __filename, __dirname) => {
    /**
     * winston.js: Top-level include defining Winston.
     *
     * (C) 2010 Charlie Robbins
     * MIT LICENCE
     */

    'use strict';

    const logform = require('logform');
    const {
      warn
    } = require('./winston/common');

    /**
     * Expose version. Use `require` method for `webpack` support.
     * @type {string}
     */
    exports.version = require('../package.json').version;
    /**
     * Include transports defined by default by winston
     * @type {Array}
     */
    exports.transports = require('./winston/transports');
    /**
     * Expose utility methods
     * @type {Object}
     */
    exports.config = require('./winston/config');
    /**
     * Hoist format-related functionality from logform.
     * @type {Object}
     */
    exports.addColors = logform.levels;
    /**
     * Hoist format-related functionality from logform.
     * @type {Object}
     */
    exports.format = logform.format;
    /**
     * Expose core Logging-related prototypes.
     * @type {function}
     */
    exports.createLogger = require('./winston/create-logger');
    /**
     * Expose core Logging-related prototypes.
     * @type {function}
     */
    exports.Logger = require('./winston/logger');
    /**
     * Expose core Logging-related prototypes.
     * @type {Object}
     */
    exports.ExceptionHandler = require('./winston/exception-handler');
    /**
     * Expose core Logging-related prototypes.
     * @type {Object}
     */
    exports.RejectionHandler = require('./winston/rejection-handler');
    /**
     * Expose core Logging-related prototypes.
     * @type {Container}
     */
    exports.Container = require('./winston/container');
    /**
     * Expose core Logging-related prototypes.
     * @type {Object}
     */
    exports.Transport = require('winston-transport');
    /**
     * We create and expose a default `Container` to `winston.loggers` so that the
     * programmer may manage multiple `winston.Logger` instances without any
     * additional overhead.
     * @example
     *   // some-file1.js
     *   const logger = require('winston').loggers.get('something');
     *
     *   // some-file2.js
     *   const logger = require('winston').loggers.get('something');
     */
    exports.loggers = new exports.Container();

    /**
     * We create and expose a 'defaultLogger' so that the programmer may do the
     * following without the need to create an instance of winston.Logger directly:
     * @example
     *   const winston = require('winston');
     *   winston.log('info', 'some message');
     *   winston.error('some error');
     */
    const defaultLogger = exports.createLogger();

    // Pass through the target methods onto `winston.
    Object.keys(exports.config.npm.levels).concat(['log', 'query', 'stream', 'add', 'remove', 'clear', 'profile', 'startTimer', 'handleExceptions', 'unhandleExceptions', 'handleRejections', 'unhandleRejections', 'configure', 'child']).forEach(method => exports[method] = (...args) => defaultLogger[method](...args));

    /**
     * Define getter / setter for the default logger level which need to be exposed
     * by winston.
     * @type {string}
     */
    Object.defineProperty(exports, 'level', {
      get() {
        return defaultLogger.level;
      },
      set(val) {
        defaultLogger.level = val;
      }
    });

    /**
     * Define getter for `exceptions` which replaces `handleExceptions` and
     * `unhandleExceptions`.
     * @type {Object}
     */
    Object.defineProperty(exports, 'exceptions', {
      get() {
        return defaultLogger.exceptions;
      }
    });

    /**
     * Define getter for `rejections` which replaces `handleRejections` and
     * `unhandleRejections`.
     * @type {Object}
     */
    Object.defineProperty(exports, 'rejections', {
      get() {
        return defaultLogger.rejections;
      }
    });

    /**
     * Define getters / setters for appropriate properties of the default logger
     * which need to be exposed by winston.
     * @type {Logger}
     */
    ['exitOnError'].forEach(prop => {
      Object.defineProperty(exports, prop, {
        get() {
          return defaultLogger[prop];
        },
        set(val) {
          defaultLogger[prop] = val;
        }
      });
    });

    /**
     * The default transports and exceptionHandlers for the default winston logger.
     * @type {Object}
     */
    Object.defineProperty(exports, 'default', {
      get() {
        return {
          exceptionHandlers: defaultLogger.exceptionHandlers,
          rejectionHandlers: defaultLogger.rejectionHandlers,
          transports: defaultLogger.transports
        };
      }
    });

    // Have friendlier breakage notices for properties that were exposed by default
    // on winston < 3.0.
    warn.deprecated(exports, 'setLevels');
    warn.forFunctions(exports, 'useFormat', ['cli']);
    warn.forProperties(exports, 'useFormat', ['padLevels', 'stripColors']);
    warn.forFunctions(exports, 'deprecated', ['addRewriter', 'addFilter', 'clone', 'extend']);
    warn.forProperties(exports, 'deprecated', ['emitErrs', 'levelLength']);
  })(__cjs_module__, __cjs_exports__, __cjs_require__, __cjs_process__, "winston@3.19.0::lib/winston.js", "winston@3.19.0::lib");
  __cjs_default__ = __cjs_module__.exports;
  __cjs_cache__.set("winston@3.19.0::lib/winston.js::NODE_ENV=production", __cjs_default__);
}
export default __cjs_default__;
export const Container = __cjs_default__["Container"];
export const ExceptionHandler = __cjs_default__["ExceptionHandler"];
export const Logger = __cjs_default__["Logger"];
export const RejectionHandler = __cjs_default__["RejectionHandler"];
export const Transport = __cjs_default__["Transport"];
export const addColors = __cjs_default__["addColors"];
export const config = __cjs_default__["config"];
export const createLogger = __cjs_default__["createLogger"];
export const format = __cjs_default__["format"];
export const loggers = __cjs_default__["loggers"];
export const transports = __cjs_default__["transports"];
export const version = __cjs_default__["version"];
