import __cjs_dep_0 from "./$_StatsigGlobal";
import __cjs_dep_1 from "./Diagnostics";
import __cjs_dep_2 from "./EventLogger";
import __cjs_dep_3 from "./Log";
import __cjs_dep_4 from "./StatsigMetadata";
import __cjs_dep_5 from "./StorageProvider";
import __cjs_dep_6 from "./CacheKey";
import __cjs_dep_7 from "./ClientInterfaces";
import __cjs_dep_8 from "./DataAdapterCore";
import __cjs_dep_9 from "./DownloadConfigSpecsResponse";
import __cjs_dep_10 from "./ErrorBoundary";
import __cjs_dep_11 from "./EvaluationOptions";
import __cjs_dep_12 from "./EvaluationTypes";
import __cjs_dep_13 from "./Hashing";
import __cjs_dep_14 from "./InitializeResponse";
import __cjs_dep_15 from "./MemoKey";
import __cjs_dep_16 from "./NetworkConfig";
import __cjs_dep_17 from "./NetworkCore";
import __cjs_dep_18 from "./OverrideAdapter";
import __cjs_dep_19 from "./ParamStoreTypes";
import __cjs_dep_20 from "./SafeJs";
import __cjs_dep_21 from "./SDKType";
import __cjs_dep_22 from "./SessionID";
import __cjs_dep_23 from "./SizeOf";
import __cjs_dep_24 from "./StableID";
import __cjs_dep_25 from "./StatsigClientBase";
import __cjs_dep_26 from "./StatsigClientEventEmitter";
import __cjs_dep_27 from "./StatsigDataAdapter";
import __cjs_dep_28 from "./StatsigEvent";
import __cjs_dep_29 from "./StatsigOptionsCommon";
import __cjs_dep_30 from "./StatsigPlugin";
import __cjs_dep_31 from "./StatsigTypeFactories";
import __cjs_dep_32 from "./StatsigTypes";
import __cjs_dep_33 from "./StatsigUser";
import __cjs_dep_34 from "./TypedJsonParse";
import __cjs_dep_35 from "./TypingUtils";
import __cjs_dep_36 from "./UrlConfiguration";
import __cjs_dep_37 from "./UUID";
import __cjs_dep_38 from "./VisibilityObserving";
import __cjs_dep_39 from "./StatsigUpdateDetails";
import __cjs_dep_40 from "./SDKFlags";
const __cjs_process__ = {
  env: {
    NODE_ENV: "production"
  }
};
function __cjs_require__(request) {
  switch (request) {
    case "./$_StatsigGlobal":
      return __cjs_dep_0;
    case "./Diagnostics":
      return __cjs_dep_1;
    case "./EventLogger":
      return __cjs_dep_2;
    case "./Log":
      return __cjs_dep_3;
    case "./StatsigMetadata":
      return __cjs_dep_4;
    case "./StorageProvider":
      return __cjs_dep_5;
    case "./CacheKey":
      return __cjs_dep_6;
    case "./ClientInterfaces":
      return __cjs_dep_7;
    case "./DataAdapterCore":
      return __cjs_dep_8;
    case "./DownloadConfigSpecsResponse":
      return __cjs_dep_9;
    case "./ErrorBoundary":
      return __cjs_dep_10;
    case "./EvaluationOptions":
      return __cjs_dep_11;
    case "./EvaluationTypes":
      return __cjs_dep_12;
    case "./Hashing":
      return __cjs_dep_13;
    case "./InitializeResponse":
      return __cjs_dep_14;
    case "./MemoKey":
      return __cjs_dep_15;
    case "./NetworkConfig":
      return __cjs_dep_16;
    case "./NetworkCore":
      return __cjs_dep_17;
    case "./OverrideAdapter":
      return __cjs_dep_18;
    case "./ParamStoreTypes":
      return __cjs_dep_19;
    case "./SafeJs":
      return __cjs_dep_20;
    case "./SDKType":
      return __cjs_dep_21;
    case "./SessionID":
      return __cjs_dep_22;
    case "./SizeOf":
      return __cjs_dep_23;
    case "./StableID":
      return __cjs_dep_24;
    case "./StatsigClientBase":
      return __cjs_dep_25;
    case "./StatsigClientEventEmitter":
      return __cjs_dep_26;
    case "./StatsigDataAdapter":
      return __cjs_dep_27;
    case "./StatsigEvent":
      return __cjs_dep_28;
    case "./StatsigOptionsCommon":
      return __cjs_dep_29;
    case "./StatsigPlugin":
      return __cjs_dep_30;
    case "./StatsigTypeFactories":
      return __cjs_dep_31;
    case "./StatsigTypes":
      return __cjs_dep_32;
    case "./StatsigUser":
      return __cjs_dep_33;
    case "./TypedJsonParse":
      return __cjs_dep_34;
    case "./TypingUtils":
      return __cjs_dep_35;
    case "./UrlConfiguration":
      return __cjs_dep_36;
    case "./UUID":
      return __cjs_dep_37;
    case "./VisibilityObserving":
      return __cjs_dep_38;
    case "./StatsigUpdateDetails":
      return __cjs_dep_39;
    case "./SDKFlags":
      return __cjs_dep_40;
    default:
      throw new Error("Cannot require " + request + " from @statsig/client-core@3.33.3::src/index.js");
  }
}
const __cjs_cache__ = globalThis.__BUNDLER_CJS_CACHE__ ??= new Map();
let __cjs_default__ = __cjs_cache__.get("@statsig/client-core@3.33.3::src/index.js::NODE_ENV=production");
if (!__cjs_default__) {
  const __cjs_module__ = {
    exports: {}
  };
  const __cjs_exports__ = __cjs_module__.exports;
  __cjs_cache__.set("@statsig/client-core@3.33.3::src/index.js::NODE_ENV=production", __cjs_exports__);
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
    exports.Storage = exports.Log = exports.EventLogger = exports.Diagnostics = void 0;
    /** Statsig Global should go first */
    require("./$_StatsigGlobal");
    const __StatsigGlobal_1 = require("./$_StatsigGlobal");
    const Diagnostics_1 = require("./Diagnostics");
    Object.defineProperty(exports, "Diagnostics", {
      enumerable: true,
      get: function () {
        return Diagnostics_1.Diagnostics;
      }
    });
    const EventLogger_1 = require("./EventLogger");
    Object.defineProperty(exports, "EventLogger", {
      enumerable: true,
      get: function () {
        return EventLogger_1.EventLogger;
      }
    });
    const Log_1 = require("./Log");
    Object.defineProperty(exports, "Log", {
      enumerable: true,
      get: function () {
        return Log_1.Log;
      }
    });
    const StatsigMetadata_1 = require("./StatsigMetadata");
    const StorageProvider_1 = require("./StorageProvider");
    Object.defineProperty(exports, "Storage", {
      enumerable: true,
      get: function () {
        return StorageProvider_1.Storage;
      }
    });
    __exportStar(require("./$_StatsigGlobal"), exports);
    __exportStar(require("./CacheKey"), exports);
    __exportStar(require("./ClientInterfaces"), exports);
    __exportStar(require("./DataAdapterCore"), exports);
    __exportStar(require("./Diagnostics"), exports);
    __exportStar(require("./DownloadConfigSpecsResponse"), exports);
    __exportStar(require("./ErrorBoundary"), exports);
    __exportStar(require("./EvaluationOptions"), exports);
    __exportStar(require("./EvaluationTypes"), exports);
    __exportStar(require("./Hashing"), exports);
    __exportStar(require("./InitializeResponse"), exports);
    __exportStar(require("./Log"), exports);
    __exportStar(require("./MemoKey"), exports);
    __exportStar(require("./NetworkConfig"), exports);
    __exportStar(require("./NetworkCore"), exports);
    __exportStar(require("./OverrideAdapter"), exports);
    __exportStar(require("./ParamStoreTypes"), exports);
    __exportStar(require("./SafeJs"), exports);
    __exportStar(require("./SDKType"), exports);
    __exportStar(require("./SessionID"), exports);
    __exportStar(require("./SizeOf"), exports);
    __exportStar(require("./StableID"), exports);
    __exportStar(require("./StatsigClientBase"), exports);
    __exportStar(require("./StatsigClientEventEmitter"), exports);
    __exportStar(require("./StatsigDataAdapter"), exports);
    __exportStar(require("./StatsigEvent"), exports);
    __exportStar(require("./StatsigMetadata"), exports);
    __exportStar(require("./StatsigOptionsCommon"), exports);
    __exportStar(require("./StatsigPlugin"), exports);
    __exportStar(require("./StatsigTypeFactories"), exports);
    __exportStar(require("./StatsigTypes"), exports);
    __exportStar(require("./StatsigUser"), exports);
    __exportStar(require("./StorageProvider"), exports);
    __exportStar(require("./TypedJsonParse"), exports);
    __exportStar(require("./TypingUtils"), exports);
    __exportStar(require("./UrlConfiguration"), exports);
    __exportStar(require("./UUID"), exports);
    __exportStar(require("./VisibilityObserving"), exports);
    __exportStar(require("./StatsigUpdateDetails"), exports);
    __exportStar(require("./SDKFlags"), exports);
    Object.assign((0, __StatsigGlobal_1._getStatsigGlobal)(), {
      Log: Log_1.Log,
      SDK_VERSION: StatsigMetadata_1.SDK_VERSION
    });
  })(__cjs_module__, __cjs_exports__, __cjs_require__, __cjs_process__, "@statsig/client-core@3.33.3::src/index.js", "@statsig/client-core@3.33.3::src");
  __cjs_default__ = __cjs_module__.exports;
  __cjs_cache__.set("@statsig/client-core@3.33.3::src/index.js::NODE_ENV=production", __cjs_default__);
}
export default __cjs_default__;
export const Diagnostics = __cjs_default__["Diagnostics"];
export const EventLogger = __cjs_default__["EventLogger"];
export const Log = __cjs_default__["Log"];
export const Storage = __cjs_default__["Storage"];
