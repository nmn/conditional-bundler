import __cjs_dep_0 from "./lib/dispatcher/client";
import __cjs_dep_1 from "./lib/dispatcher/dispatcher";
import __cjs_dep_2 from "./lib/dispatcher/pool";
import __cjs_dep_3 from "./lib/dispatcher/balanced-pool";
import __cjs_dep_4 from "./lib/dispatcher/round-robin-pool";
import __cjs_dep_5 from "./lib/dispatcher/agent";
import __cjs_dep_6 from "./lib/dispatcher/dispatcher1-wrapper";
import __cjs_dep_7 from "./lib/dispatcher/proxy-agent";
import __cjs_dep_8 from "./lib/dispatcher/socks5-proxy-agent";
import __cjs_dep_9 from "./lib/dispatcher/env-http-proxy-agent";
import __cjs_dep_10 from "./lib/dispatcher/retry-agent";
import __cjs_dep_11 from "./lib/dispatcher/h2c-client";
import __cjs_dep_12 from "./lib/core/errors";
import __cjs_dep_13 from "./lib/core/util";
import __cjs_dep_14 from "./lib/api";
import __cjs_dep_15 from "./lib/core/connect";
import __cjs_dep_16 from "./lib/mock/mock-client";
import __cjs_dep_17 from "./lib/mock/mock-call-history";
import __cjs_dep_18 from "./lib/mock/mock-agent";
import __cjs_dep_19 from "./lib/mock/mock-pool";
import __cjs_dep_20 from "./lib/mock/snapshot-agent";
import __cjs_dep_21 from "./lib/mock/mock-errors";
import __cjs_dep_22 from "./lib/handler/retry-handler";
import __cjs_dep_23 from "./lib/global";
import __cjs_dep_24 from "./lib/handler/decorator-handler";
import __cjs_dep_25 from "./lib/handler/redirect-handler";
import __cjs_dep_26 from "./lib/interceptor/redirect";
import __cjs_dep_27 from "./lib/interceptor/response-error";
import __cjs_dep_28 from "./lib/interceptor/retry";
import __cjs_dep_29 from "./lib/interceptor/dump";
import __cjs_dep_30 from "./lib/interceptor/dns";
import __cjs_dep_31 from "./lib/interceptor/cache";
import __cjs_dep_32 from "./lib/interceptor/decompress";
import __cjs_dep_33 from "./lib/interceptor/deduplicate";
import __cjs_dep_34 from "./lib/cache/memory-cache-store";
import __cjs_dep_35 from "./lib/cache/sqlite-cache-store";
import __cjs_dep_36 from "./lib/web/fetch";
import __cjs_dep_37 from "./lib/web/fetch/headers";
import __cjs_dep_38 from "./lib/web/fetch/response";
import __cjs_dep_39 from "./lib/web/fetch/request";
import __cjs_dep_40 from "./lib/web/fetch/formdata";
import __cjs_dep_41 from "./lib/web/fetch/global";
import __cjs_dep_42 from "./lib/web/cache/cachestorage";
import __cjs_dep_43 from "./lib/core/symbols";
import __cjs_dep_44 from "./lib/web/cookies";
import __cjs_dep_45 from "./lib/web/fetch/data-url";
import __cjs_dep_46 from "./lib/web/websocket/events";
import __cjs_dep_47 from "./lib/web/websocket/websocket";
import __cjs_dep_48 from "./lib/web/websocket/stream/websocketstream";
import __cjs_dep_49 from "./lib/web/websocket/stream/websocketerror";
import __cjs_dep_50 from "./lib/web/eventsource/eventsource";
const __cjs_process__ = {
  env: {
    NODE_ENV: "production"
  }
};
function __cjs_require__(request) {
  switch (request) {
    case "./lib/dispatcher/client":
      return __cjs_dep_0;
    case "./lib/dispatcher/dispatcher":
      return __cjs_dep_1;
    case "./lib/dispatcher/pool":
      return __cjs_dep_2;
    case "./lib/dispatcher/balanced-pool":
      return __cjs_dep_3;
    case "./lib/dispatcher/round-robin-pool":
      return __cjs_dep_4;
    case "./lib/dispatcher/agent":
      return __cjs_dep_5;
    case "./lib/dispatcher/dispatcher1-wrapper":
      return __cjs_dep_6;
    case "./lib/dispatcher/proxy-agent":
      return __cjs_dep_7;
    case "./lib/dispatcher/socks5-proxy-agent":
      return __cjs_dep_8;
    case "./lib/dispatcher/env-http-proxy-agent":
      return __cjs_dep_9;
    case "./lib/dispatcher/retry-agent":
      return __cjs_dep_10;
    case "./lib/dispatcher/h2c-client":
      return __cjs_dep_11;
    case "./lib/core/errors":
      return __cjs_dep_12;
    case "./lib/core/util":
      return __cjs_dep_13;
    case "./lib/api":
      return __cjs_dep_14;
    case "./lib/core/connect":
      return __cjs_dep_15;
    case "./lib/mock/mock-client":
      return __cjs_dep_16;
    case "./lib/mock/mock-call-history":
      return __cjs_dep_17;
    case "./lib/mock/mock-agent":
      return __cjs_dep_18;
    case "./lib/mock/mock-pool":
      return __cjs_dep_19;
    case "./lib/mock/snapshot-agent":
      return __cjs_dep_20;
    case "./lib/mock/mock-errors":
      return __cjs_dep_21;
    case "./lib/handler/retry-handler":
      return __cjs_dep_22;
    case "./lib/global":
      return __cjs_dep_23;
    case "./lib/handler/decorator-handler":
      return __cjs_dep_24;
    case "./lib/handler/redirect-handler":
      return __cjs_dep_25;
    case "./lib/interceptor/redirect":
      return __cjs_dep_26;
    case "./lib/interceptor/response-error":
      return __cjs_dep_27;
    case "./lib/interceptor/retry":
      return __cjs_dep_28;
    case "./lib/interceptor/dump":
      return __cjs_dep_29;
    case "./lib/interceptor/dns":
      return __cjs_dep_30;
    case "./lib/interceptor/cache":
      return __cjs_dep_31;
    case "./lib/interceptor/decompress":
      return __cjs_dep_32;
    case "./lib/interceptor/deduplicate":
      return __cjs_dep_33;
    case "./lib/cache/memory-cache-store":
      return __cjs_dep_34;
    case "./lib/cache/sqlite-cache-store":
      return __cjs_dep_35;
    case "./lib/web/fetch":
      return __cjs_dep_36;
    case "./lib/web/fetch/headers":
      return __cjs_dep_37;
    case "./lib/web/fetch/response":
      return __cjs_dep_38;
    case "./lib/web/fetch/request":
      return __cjs_dep_39;
    case "./lib/web/fetch/formdata":
      return __cjs_dep_40;
    case "./lib/web/fetch/global":
      return __cjs_dep_41;
    case "./lib/web/cache/cachestorage":
      return __cjs_dep_42;
    case "./lib/core/symbols":
      return __cjs_dep_43;
    case "./lib/web/cookies":
      return __cjs_dep_44;
    case "./lib/web/fetch/data-url":
      return __cjs_dep_45;
    case "./lib/web/websocket/events":
      return __cjs_dep_46;
    case "./lib/web/websocket/websocket":
      return __cjs_dep_47;
    case "./lib/web/websocket/stream/websocketstream":
      return __cjs_dep_48;
    case "./lib/web/websocket/stream/websocketerror":
      return __cjs_dep_49;
    case "./lib/web/eventsource/eventsource":
      return __cjs_dep_50;
    default:
      throw new Error("Cannot require " + request + " from undici@8.7.0::index.js");
  }
}
const __cjs_cache__ = globalThis.__BUNDLER_CJS_CACHE__ ??= new Map();
let __cjs_default__ = __cjs_cache__.get("undici@8.7.0::index.js::env=snapshot::NODE_ENV=production");
if (!__cjs_default__) {
  const __cjs_module__ = {
    exports: {}
  };
  const __cjs_exports__ = __cjs_module__.exports;
  __cjs_cache__.set("undici@8.7.0::index.js::env=snapshot::NODE_ENV=production", __cjs_exports__);
  ((module, exports, require, process, __filename, __dirname) => {
    'use strict';

    const Client = require('./lib/dispatcher/client');
    const Dispatcher = require('./lib/dispatcher/dispatcher');
    const Pool = require('./lib/dispatcher/pool');
    const BalancedPool = require('./lib/dispatcher/balanced-pool');
    const RoundRobinPool = require('./lib/dispatcher/round-robin-pool');
    const Agent = require('./lib/dispatcher/agent');
    const Dispatcher1Wrapper = require('./lib/dispatcher/dispatcher1-wrapper');
    const ProxyAgent = require('./lib/dispatcher/proxy-agent');
    const Socks5ProxyAgent = require('./lib/dispatcher/socks5-proxy-agent');
    const EnvHttpProxyAgent = require('./lib/dispatcher/env-http-proxy-agent');
    const RetryAgent = require('./lib/dispatcher/retry-agent');
    const H2CClient = require('./lib/dispatcher/h2c-client');
    const errors = require('./lib/core/errors');
    const util = require('./lib/core/util');
    const {
      InvalidArgumentError
    } = errors;
    const api = require('./lib/api');
    const buildConnector = require('./lib/core/connect');
    const MockClient = require('./lib/mock/mock-client');
    const {
      MockCallHistory,
      MockCallHistoryLog
    } = require('./lib/mock/mock-call-history');
    const MockAgent = require('./lib/mock/mock-agent');
    const MockPool = require('./lib/mock/mock-pool');
    const SnapshotAgent = require('./lib/mock/snapshot-agent');
    const mockErrors = require('./lib/mock/mock-errors');
    const RetryHandler = require('./lib/handler/retry-handler');
    const {
      getGlobalDispatcher,
      setGlobalDispatcher
    } = require('./lib/global');
    const DecoratorHandler = require('./lib/handler/decorator-handler');
    const RedirectHandler = require('./lib/handler/redirect-handler');
    Object.assign(Dispatcher.prototype, api);
    module.exports.Dispatcher = Dispatcher;
    module.exports.Client = Client;
    module.exports.Pool = Pool;
    module.exports.BalancedPool = BalancedPool;
    module.exports.RoundRobinPool = RoundRobinPool;
    module.exports.Agent = Agent;
    module.exports.Dispatcher1Wrapper = Dispatcher1Wrapper;
    module.exports.ProxyAgent = ProxyAgent;
    module.exports.Socks5ProxyAgent = Socks5ProxyAgent;
    module.exports.EnvHttpProxyAgent = EnvHttpProxyAgent;
    module.exports.RetryAgent = RetryAgent;
    module.exports.H2CClient = H2CClient;
    module.exports.RetryHandler = RetryHandler;
    module.exports.DecoratorHandler = DecoratorHandler;
    module.exports.RedirectHandler = RedirectHandler;
    module.exports.interceptors = {
      redirect: require('./lib/interceptor/redirect'),
      responseError: require('./lib/interceptor/response-error'),
      retry: require('./lib/interceptor/retry'),
      dump: require('./lib/interceptor/dump'),
      dns: require('./lib/interceptor/dns'),
      cache: require('./lib/interceptor/cache'),
      decompress: require('./lib/interceptor/decompress'),
      deduplicate: require('./lib/interceptor/deduplicate')
    };
    module.exports.cacheStores = {
      MemoryCacheStore: require('./lib/cache/memory-cache-store')
    };
    const SqliteCacheStore = require('./lib/cache/sqlite-cache-store');
    module.exports.cacheStores.SqliteCacheStore = SqliteCacheStore;
    module.exports.buildConnector = buildConnector;
    module.exports.errors = errors;
    module.exports.util = {
      parseHeaders: util.parseHeaders,
      headerNameToString: util.headerNameToString
    };
    function makeDispatcher(fn) {
      return (url, opts, handler) => {
        if (typeof opts === 'function') {
          handler = opts;
          opts = null;
        }
        if (!url || typeof url !== 'string' && typeof url !== 'object' && !(url instanceof URL)) {
          throw new InvalidArgumentError('invalid url');
        }
        if (opts != null && typeof opts !== 'object') {
          throw new InvalidArgumentError('invalid opts');
        }
        if (opts && opts.path != null) {
          if (typeof opts.path !== 'string') {
            throw new InvalidArgumentError('invalid opts.path');
          }
          let path = opts.path;
          if (!opts.path.startsWith('/')) {
            path = `/${path}`;
          }
          url = new URL(util.parseOrigin(url).origin + path);
        } else {
          if (!opts) {
            opts = typeof url === 'object' ? url : {};
          }
          url = util.parseURL(url);
        }
        const {
          agent,
          dispatcher = getGlobalDispatcher(),
          ...restOpts
        } = opts;
        if (agent) {
          throw new InvalidArgumentError('unsupported opts.agent. Did you mean opts.client?');
        }
        return fn.call(dispatcher, {
          ...restOpts,
          origin: url.origin,
          path: url.search ? `${url.pathname}${url.search}` : url.pathname,
          method: opts.method || (opts.body ? 'PUT' : 'GET')
        }, handler);
      };
    }
    module.exports.setGlobalDispatcher = setGlobalDispatcher;
    module.exports.getGlobalDispatcher = getGlobalDispatcher;
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
    module.exports.Headers = require('./lib/web/fetch/headers').Headers;
    module.exports.Response = require('./lib/web/fetch/response').Response;
    module.exports.Request = require('./lib/web/fetch/request').Request;
    module.exports.FormData = require('./lib/web/fetch/formdata').FormData;
    const {
      setGlobalOrigin,
      getGlobalOrigin
    } = require('./lib/web/fetch/global');
    module.exports.setGlobalOrigin = setGlobalOrigin;
    module.exports.getGlobalOrigin = getGlobalOrigin;
    const {
      CacheStorage
    } = require('./lib/web/cache/cachestorage');
    const {
      kConstruct
    } = require('./lib/core/symbols');
    module.exports.caches = new CacheStorage(kConstruct);
    const {
      deleteCookie,
      getCookies,
      getSetCookies,
      setCookie,
      parseCookie
    } = require('./lib/web/cookies');
    module.exports.deleteCookie = deleteCookie;
    module.exports.getCookies = getCookies;
    module.exports.getSetCookies = getSetCookies;
    module.exports.setCookie = setCookie;
    module.exports.parseCookie = parseCookie;
    const {
      parseMIMEType,
      serializeAMimeType
    } = require('./lib/web/fetch/data-url');
    module.exports.parseMIMEType = parseMIMEType;
    module.exports.serializeAMimeType = serializeAMimeType;
    const {
      CloseEvent,
      ErrorEvent,
      MessageEvent
    } = require('./lib/web/websocket/events');
    const {
      WebSocket,
      ping
    } = require('./lib/web/websocket/websocket');
    module.exports.WebSocket = WebSocket;
    module.exports.CloseEvent = CloseEvent;
    module.exports.ErrorEvent = ErrorEvent;
    module.exports.MessageEvent = MessageEvent;
    module.exports.ping = ping;
    module.exports.WebSocketStream = require('./lib/web/websocket/stream/websocketstream').WebSocketStream;
    module.exports.WebSocketError = require('./lib/web/websocket/stream/websocketerror').WebSocketError;
    module.exports.request = makeDispatcher(api.request);
    module.exports.stream = makeDispatcher(api.stream);
    module.exports.pipeline = makeDispatcher(api.pipeline);
    module.exports.connect = makeDispatcher(api.connect);
    module.exports.upgrade = makeDispatcher(api.upgrade);
    module.exports.MockClient = MockClient;
    module.exports.MockCallHistory = MockCallHistory;
    module.exports.MockCallHistoryLog = MockCallHistoryLog;
    module.exports.MockPool = MockPool;
    module.exports.MockAgent = MockAgent;
    module.exports.SnapshotAgent = SnapshotAgent;
    module.exports.mockErrors = mockErrors;
    const {
      EventSource
    } = require('./lib/web/eventsource/eventsource');
    module.exports.EventSource = EventSource;
    function install() {
      globalThis.fetch = module.exports.fetch;
      globalThis.Headers = module.exports.Headers;
      globalThis.Response = module.exports.Response;
      globalThis.Request = module.exports.Request;
      globalThis.FormData = module.exports.FormData;
      globalThis.WebSocket = module.exports.WebSocket;
      globalThis.CloseEvent = module.exports.CloseEvent;
      globalThis.ErrorEvent = module.exports.ErrorEvent;
      globalThis.MessageEvent = module.exports.MessageEvent;
      globalThis.EventSource = module.exports.EventSource;
    }
    module.exports.install = install;
  })(__cjs_module__, __cjs_exports__, __cjs_require__, __cjs_process__, "undici@8.7.0::index.js", ".");
  __cjs_default__ = __cjs_module__.exports;
  __cjs_cache__.set("undici@8.7.0::index.js::env=snapshot::NODE_ENV=production", __cjs_default__);
}
export default __cjs_default__;
export const Agent = __cjs_default__["Agent"];
export const BalancedPool = __cjs_default__["BalancedPool"];
export const Client = __cjs_default__["Client"];
export const CloseEvent = __cjs_default__["CloseEvent"];
export const DecoratorHandler = __cjs_default__["DecoratorHandler"];
export const Dispatcher = __cjs_default__["Dispatcher"];
export const Dispatcher1Wrapper = __cjs_default__["Dispatcher1Wrapper"];
export const EnvHttpProxyAgent = __cjs_default__["EnvHttpProxyAgent"];
export const ErrorEvent = __cjs_default__["ErrorEvent"];
export const EventSource = __cjs_default__["EventSource"];
export const FormData = __cjs_default__["FormData"];
export const H2CClient = __cjs_default__["H2CClient"];
export const Headers = __cjs_default__["Headers"];
export const MessageEvent = __cjs_default__["MessageEvent"];
export const MockAgent = __cjs_default__["MockAgent"];
export const MockCallHistory = __cjs_default__["MockCallHistory"];
export const MockCallHistoryLog = __cjs_default__["MockCallHistoryLog"];
export const MockClient = __cjs_default__["MockClient"];
export const MockPool = __cjs_default__["MockPool"];
export const Pool = __cjs_default__["Pool"];
export const ProxyAgent = __cjs_default__["ProxyAgent"];
export const RedirectHandler = __cjs_default__["RedirectHandler"];
export const Request = __cjs_default__["Request"];
export const Response = __cjs_default__["Response"];
export const RetryAgent = __cjs_default__["RetryAgent"];
export const RetryHandler = __cjs_default__["RetryHandler"];
export const RoundRobinPool = __cjs_default__["RoundRobinPool"];
export const SnapshotAgent = __cjs_default__["SnapshotAgent"];
export const Socks5ProxyAgent = __cjs_default__["Socks5ProxyAgent"];
export const WebSocket = __cjs_default__["WebSocket"];
export const WebSocketError = __cjs_default__["WebSocketError"];
export const WebSocketStream = __cjs_default__["WebSocketStream"];
export const buildConnector = __cjs_default__["buildConnector"];
export const cacheStores = __cjs_default__["cacheStores"];
export const caches = __cjs_default__["caches"];
export const connect = __cjs_default__["connect"];
export const deleteCookie = __cjs_default__["deleteCookie"];
export const errors = __cjs_default__["errors"];
export const fetch = __cjs_default__["fetch"];
export const getCookies = __cjs_default__["getCookies"];
export const getGlobalDispatcher = __cjs_default__["getGlobalDispatcher"];
export const getGlobalOrigin = __cjs_default__["getGlobalOrigin"];
export const getSetCookies = __cjs_default__["getSetCookies"];
export const install = __cjs_default__["install"];
export const interceptors = __cjs_default__["interceptors"];
export const mockErrors = __cjs_default__["mockErrors"];
export const parseCookie = __cjs_default__["parseCookie"];
export const parseMIMEType = __cjs_default__["parseMIMEType"];
export const ping = __cjs_default__["ping"];
export const pipeline = __cjs_default__["pipeline"];
export const request = __cjs_default__["request"];
export const serializeAMimeType = __cjs_default__["serializeAMimeType"];
export const setCookie = __cjs_default__["setCookie"];
export const setGlobalDispatcher = __cjs_default__["setGlobalDispatcher"];
export const setGlobalOrigin = __cjs_default__["setGlobalOrigin"];
export const stream = __cjs_default__["stream"];
export const upgrade = __cjs_default__["upgrade"];
export const util = __cjs_default__["util"];
