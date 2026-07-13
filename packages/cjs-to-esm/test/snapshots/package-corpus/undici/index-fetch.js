import __cjs_dep_0 from "./lib/global";
import __cjs_dep_1 from "./lib/dispatcher/env-http-proxy-agent";
import __cjs_dep_2 from "./lib/web/fetch";
import __cjs_dep_3 from "./lib/web/fetch/formdata";
import __cjs_dep_4 from "./lib/web/fetch/headers";
import __cjs_dep_5 from "./lib/web/fetch/response";
import __cjs_dep_6 from "./lib/web/fetch/request";
import __cjs_dep_7 from "./lib/web/websocket/events";
import __cjs_dep_8 from "./lib/web/websocket/websocket";
import __cjs_dep_9 from "./lib/web/eventsource/eventsource";
import __cjs_dep_10 from "./lib/api";
import __cjs_dep_11 from "./lib/dispatcher/dispatcher";
const __cjs_process__ = {
  env: {
    NODE_ENV: "production"
  }
};
function __cjs_require__(request) {
  switch (request) {
    case "./lib/global":
      return __cjs_dep_0;
    case "./lib/dispatcher/env-http-proxy-agent":
      return __cjs_dep_1;
    case "./lib/web/fetch":
      return __cjs_dep_2;
    case "./lib/web/fetch/formdata":
      return __cjs_dep_3;
    case "./lib/web/fetch/headers":
      return __cjs_dep_4;
    case "./lib/web/fetch/response":
      return __cjs_dep_5;
    case "./lib/web/fetch/request":
      return __cjs_dep_6;
    case "./lib/web/websocket/events":
      return __cjs_dep_7;
    case "./lib/web/websocket/websocket":
      return __cjs_dep_8;
    case "./lib/web/eventsource/eventsource":
      return __cjs_dep_9;
    case "./lib/api":
      return __cjs_dep_10;
    case "./lib/dispatcher/dispatcher":
      return __cjs_dep_11;
    default:
      throw new Error("Cannot require " + request + " from undici@8.7.0/index-fetch.js");
  }
}
const __cjs_cache__ = globalThis.__BUNDLER_CJS_CACHE__ ??= new Map();
let __cjs_default__ = __cjs_cache__.get("undici@8.7.0/index-fetch.js");
if (!__cjs_default__) {
  const __cjs_module__ = {
    exports: {}
  };
  const __cjs_exports__ = __cjs_module__.exports;
  __cjs_cache__.set("undici@8.7.0/index-fetch.js", __cjs_exports__);
  ((module, exports, require, process) => {
    'use strict';

    const {
      getGlobalDispatcher,
      setGlobalDispatcher
    } = require('./lib/global');
    const EnvHttpProxyAgent = require('./lib/dispatcher/env-http-proxy-agent');
    const fetchImpl = require('./lib/web/fetch').fetch;

    // Capture __filename at module load time for stack trace augmentation.
    // This may be undefined when bundled in environments like Node.js internals.
    const currentFilename = typeof __filename !== 'undefined' ? __filename : undefined;
    function appendFetchStackTrace(err, filename) {
      if (!err || typeof err !== 'object') {
        return;
      }
      const stack = typeof err.stack === 'string' ? err.stack : '';
      const normalizedFilename = filename.replace(/\\/g, '/');
      if (stack && (stack.includes(filename) || stack.includes(normalizedFilename))) {
        return;
      }
      const capture = {};
      Error.captureStackTrace(capture, appendFetchStackTrace);
      if (!capture.stack) {
        return;
      }
      const captureLines = capture.stack.split('\n').slice(1).join('\n');
      err.stack = stack ? `${stack}\n${captureLines}` : capture.stack;
    }
    module.exports.fetch = function fetch(init, options = undefined) {
      return fetchImpl(init, options).catch(err => {
        if (currentFilename) {
          appendFetchStackTrace(err, currentFilename);
        } else if (err && typeof err === 'object') {
          Error.captureStackTrace(err, module.exports.fetch);
        }
        throw err;
      });
    };
    module.exports.FormData = require('./lib/web/fetch/formdata').FormData;
    module.exports.Headers = require('./lib/web/fetch/headers').Headers;
    module.exports.Response = require('./lib/web/fetch/response').Response;
    module.exports.Request = require('./lib/web/fetch/request').Request;
    const {
      CloseEvent,
      ErrorEvent,
      MessageEvent,
      createFastMessageEvent
    } = require('./lib/web/websocket/events');
    module.exports.WebSocket = require('./lib/web/websocket/websocket').WebSocket;
    module.exports.CloseEvent = CloseEvent;
    module.exports.ErrorEvent = ErrorEvent;
    module.exports.MessageEvent = MessageEvent;
    module.exports.createFastMessageEvent = createFastMessageEvent;
    module.exports.EventSource = require('./lib/web/eventsource/eventsource').EventSource;
    const api = require('./lib/api');
    const Dispatcher = require('./lib/dispatcher/dispatcher');
    Object.assign(Dispatcher.prototype, api);
    // Expose the fetch implementation to be enabled in Node.js core via a flag
    module.exports.EnvHttpProxyAgent = EnvHttpProxyAgent;
    module.exports.getGlobalDispatcher = getGlobalDispatcher;
    module.exports.setGlobalDispatcher = setGlobalDispatcher;
  })(__cjs_module__, __cjs_exports__, __cjs_require__, __cjs_process__);
  __cjs_default__ = __cjs_module__.exports;
  __cjs_cache__.set("undici@8.7.0/index-fetch.js", __cjs_default__);
}
export default __cjs_default__;
export const CloseEvent = __cjs_default__["CloseEvent"];
export const EnvHttpProxyAgent = __cjs_default__["EnvHttpProxyAgent"];
export const ErrorEvent = __cjs_default__["ErrorEvent"];
export const EventSource = __cjs_default__["EventSource"];
export const FormData = __cjs_default__["FormData"];
export const Headers = __cjs_default__["Headers"];
export const MessageEvent = __cjs_default__["MessageEvent"];
export const Request = __cjs_default__["Request"];
export const Response = __cjs_default__["Response"];
export const WebSocket = __cjs_default__["WebSocket"];
export const createFastMessageEvent = __cjs_default__["createFastMessageEvent"];
export const fetch = __cjs_default__["fetch"];
export const getGlobalDispatcher = __cjs_default__["getGlobalDispatcher"];
export const setGlobalDispatcher = __cjs_default__["setGlobalDispatcher"];
