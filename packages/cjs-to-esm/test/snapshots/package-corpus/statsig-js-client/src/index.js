import __cjs_dep_0 from "@statsig/client-core";
import __cjs_dep_1 from "./StatsigClient";
const __cjs_process__ = {
  env: {
    NODE_ENV: "production"
  }
};
function __cjs_require__(request) {
  switch (request) {
    case "@statsig/client-core":
      return __cjs_dep_0;
    case "./StatsigClient":
      return __cjs_dep_1;
    default:
      throw new Error("Cannot require " + request + " from @statsig/js-client@3.33.3::src/index.js");
  }
}
const __cjs_cache__ = globalThis.__BUNDLER_CJS_CACHE__ ??= new Map();
let __cjs_default__ = __cjs_cache__.get("@statsig/js-client@3.33.3::src/index.js::NODE_ENV=production");
if (!__cjs_default__) {
  const __cjs_module__ = {
    exports: {}
  };
  const __cjs_exports__ = __cjs_module__.exports;
  __cjs_cache__.set("@statsig/js-client@3.33.3::src/index.js::NODE_ENV=production", __cjs_exports__);
  ((module, exports, require, process, __filename, __dirname) => {
    "use strict";

    var __createBinding = this && this.__createBinding || (Object.create ? function (o, m, k, k2) {
      if (k2 === undefined) k2 = k;
      var desc = Object.getOwnPropertyDescriptor(m, k);
      if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = {
          enumerable: true,
          get: function () {
            return m[k];
          }
        };
      }
      Object.defineProperty(o, k2, desc);
    } : function (o, m, k, k2) {
      if (k2 === undefined) k2 = k;
      o[k2] = m[k];
    });
    var __exportStar = this && this.__exportStar || function (m, exports) {
      for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
    };
    Object.defineProperty(exports, "__esModule", {
      value: true
    });
    exports.StatsigClient = void 0;
    const client_core_1 = require("@statsig/client-core");
    const StatsigClient_1 = require("./StatsigClient");
    exports.StatsigClient = StatsigClient_1.default;
    __exportStar(require("@statsig/client-core"), exports);
    const __STATSIG__ = Object.assign((0, client_core_1._getStatsigGlobal)(), {
      StatsigClient: StatsigClient_1.default
    });
    exports.default = __STATSIG__;
  })(__cjs_module__, __cjs_exports__, __cjs_require__, __cjs_process__, "@statsig/js-client@3.33.3::src/index.js", "@statsig/js-client@3.33.3::src");
  __cjs_default__ = __cjs_module__.exports;
  __cjs_cache__.set("@statsig/js-client@3.33.3::src/index.js::NODE_ENV=production", __cjs_default__);
}
export default __cjs_default__;
export const StatsigClient = __cjs_default__["StatsigClient"];
