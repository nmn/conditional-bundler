import __cjs_dep_0 from "./Log";
const __cjs_process__ = {
  env: {
    NODE_ENV: "production"
  }
};
function __cjs_require__(request) {
  switch (request) {
    case "./Log":
      return __cjs_dep_0;
    default:
      throw new Error("Cannot require " + request + " from @statsig/client-core@3.33.3::src/SafeJs.js");
  }
}
const __cjs_cache__ = globalThis.__BUNDLER_CJS_CACHE__ ??= new Map();
let __cjs_default__ = __cjs_cache__.get("@statsig/client-core@3.33.3::src/SafeJs.js::NODE_ENV=production");
if (!__cjs_default__) {
  const __cjs_module__ = {
    exports: {}
  };
  const __cjs_exports__ = __cjs_module__.exports;
  __cjs_cache__.set("@statsig/client-core@3.33.3::src/SafeJs.js::NODE_ENV=production", __cjs_exports__);
  ((module, exports, require, process, __filename, __dirname) => {
    "use strict";

    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports._cloneObject = exports._getUnloadEvent = exports._getCurrentPageUrlSafe = exports._addDocumentEventListenerSafe = exports._addWindowEventListenerSafe = exports._isServerEnv = exports._getDocumentSafe = exports._getWindowSafe = void 0;
    const Log_1 = require("./Log");
    const _getWindowSafe = () => {
      return typeof window !== 'undefined' ? window : null;
    };
    exports._getWindowSafe = _getWindowSafe;
    const _getDocumentSafe = () => {
      var _a;
      const win = (0, exports._getWindowSafe)();
      return (_a = win === null || win === void 0 ? void 0 : win.document) !== null && _a !== void 0 ? _a : null;
    };
    exports._getDocumentSafe = _getDocumentSafe;
    const _isServerEnv = () => {
      if ((0, exports._getDocumentSafe)() !== null) {
        return false;
      }
      const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;
      const isVercel = typeof EdgeRuntime === 'string';
      return isVercel || isNode;
    };
    exports._isServerEnv = _isServerEnv;
    const _addWindowEventListenerSafe = (key, listener) => {
      const win = (0, exports._getWindowSafe)();
      if (typeof (win === null || win === void 0 ? void 0 : win.addEventListener) === 'function') {
        win.addEventListener(key, listener);
      }
    };
    exports._addWindowEventListenerSafe = _addWindowEventListenerSafe;
    const _addDocumentEventListenerSafe = (key, listener) => {
      const doc = (0, exports._getDocumentSafe)();
      if (typeof (doc === null || doc === void 0 ? void 0 : doc.addEventListener) === 'function') {
        doc.addEventListener(key, listener);
      }
    };
    exports._addDocumentEventListenerSafe = _addDocumentEventListenerSafe;
    const _getCurrentPageUrlSafe = () => {
      var _a;
      try {
        return (_a = (0, exports._getWindowSafe)()) === null || _a === void 0 ? void 0 : _a.location.href.split(/[?#]/)[0];
      } catch (_b) {
        return;
      }
    };
    exports._getCurrentPageUrlSafe = _getCurrentPageUrlSafe;
    const _getUnloadEvent = () => {
      const win = (0, exports._getWindowSafe)();
      if (!win) {
        return 'beforeunload';
      }
      const eventType = 'onpagehide' in win ? 'pagehide' : 'beforeunload';
      return eventType;
    };
    exports._getUnloadEvent = _getUnloadEvent;
    const _cloneObject = (tag, obj) => {
      try {
        return JSON.parse(JSON.stringify(obj));
      } catch (error) {
        Log_1.Log.error(`Failed to clone object ${tag}`);
        return null;
      }
    };
    exports._cloneObject = _cloneObject;
  })(__cjs_module__, __cjs_exports__, __cjs_require__, __cjs_process__, "@statsig/client-core@3.33.3::src/SafeJs.js", "@statsig/client-core@3.33.3::src");
  __cjs_default__ = __cjs_module__.exports;
  __cjs_cache__.set("@statsig/client-core@3.33.3::src/SafeJs.js::NODE_ENV=production", __cjs_default__);
}
export default __cjs_default__;
export const _addDocumentEventListenerSafe = __cjs_default__["_addDocumentEventListenerSafe"];
export const _addWindowEventListenerSafe = __cjs_default__["_addWindowEventListenerSafe"];
export const _cloneObject = __cjs_default__["_cloneObject"];
export const _getCurrentPageUrlSafe = __cjs_default__["_getCurrentPageUrlSafe"];
export const _getDocumentSafe = __cjs_default__["_getDocumentSafe"];
export const _getUnloadEvent = __cjs_default__["_getUnloadEvent"];
export const _getWindowSafe = __cjs_default__["_getWindowSafe"];
export const _isServerEnv = __cjs_default__["_isServerEnv"];
