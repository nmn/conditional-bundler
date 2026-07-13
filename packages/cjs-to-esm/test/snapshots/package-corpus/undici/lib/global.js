import __cjs_dep_0 from "./core/errors";
import __cjs_dep_1 from "./dispatcher/agent";
import __cjs_dep_2 from "./dispatcher/dispatcher1-wrapper";
const __cjs_process__ = {
  env: {
    NODE_ENV: "production"
  }
};
function __cjs_require__(request) {
  switch (request) {
    case "./core/errors":
      return __cjs_dep_0;
    case "./dispatcher/agent":
      return __cjs_dep_1;
    case "./dispatcher/dispatcher1-wrapper":
      return __cjs_dep_2;
    default:
      throw new Error("Cannot require " + request + " from undici@8.7.0/lib/global.js");
  }
}
const __cjs_cache__ = globalThis.__BUNDLER_CJS_CACHE__ ??= new Map();
let __cjs_default__ = __cjs_cache__.get("undici@8.7.0/lib/global.js");
if (!__cjs_default__) {
  const __cjs_module__ = {
    exports: {}
  };
  const __cjs_exports__ = __cjs_module__.exports;
  __cjs_cache__.set("undici@8.7.0/lib/global.js", __cjs_exports__);
  ((module, exports, require, process) => {
    'use strict';

    // We include a version number for the Dispatcher API. In case of breaking changes,
    // this version number must be increased to avoid conflicts.
    const globalDispatcher = Symbol.for('undici.globalDispatcher.2');
    const legacyGlobalDispatcher = Symbol.for('undici.globalDispatcher.1');
    const {
      InvalidArgumentError
    } = require('./core/errors');
    const Agent = require('./dispatcher/agent');
    const Dispatcher1Wrapper = require('./dispatcher/dispatcher1-wrapper');
    if (getGlobalDispatcher() === undefined) {
      setGlobalDispatcher(new Agent());
    }
    function setGlobalDispatcher(agent) {
      if (!agent || typeof agent.dispatch !== 'function') {
        throw new InvalidArgumentError('Argument agent must implement Agent');
      }
      Object.defineProperty(globalThis, globalDispatcher, {
        value: agent,
        writable: true,
        enumerable: false,
        configurable: false
      });
      const legacyAgent = agent instanceof Dispatcher1Wrapper ? agent : new Dispatcher1Wrapper(agent);
      Object.defineProperty(globalThis, legacyGlobalDispatcher, {
        value: legacyAgent,
        writable: true,
        enumerable: false,
        configurable: false
      });
    }
    function getGlobalDispatcher() {
      return globalThis[globalDispatcher];
    }

    // These are the globals that can be installed by undici.install().
    // Not exported by index.js to avoid use outside of this module.
    const installedExports = /** @type {const} */
    ['fetch', 'Headers', 'Response', 'Request', 'FormData', 'WebSocket', 'CloseEvent', 'ErrorEvent', 'MessageEvent', 'EventSource'];
    module.exports = {
      setGlobalDispatcher,
      getGlobalDispatcher,
      installedExports
    };
  })(__cjs_module__, __cjs_exports__, __cjs_require__, __cjs_process__);
  __cjs_default__ = __cjs_module__.exports;
  __cjs_cache__.set("undici@8.7.0/lib/global.js", __cjs_default__);
}
export default __cjs_default__;
export const getGlobalDispatcher = __cjs_default__["getGlobalDispatcher"];
export const installedExports = __cjs_default__["installedExports"];
export const setGlobalDispatcher = __cjs_default__["setGlobalDispatcher"];
