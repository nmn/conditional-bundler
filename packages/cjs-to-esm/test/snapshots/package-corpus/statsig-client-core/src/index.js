import { _getInstance, _getStatsigGlobal, _getStatsigGlobalFlag } from "./$_StatsigGlobal";
import { _getStorageKey, _getUserStorageKey } from "./CacheKey";
import { PrecomputedEvaluationsContextHandle as _PrecomputedEvaluationsContextHandle } from "./ClientInterfaces";
import { DataAdapterCore as _DataAdapterCore, _makeDataAdapterResult } from "./DataAdapterCore";
import { EXCEPTION_ENDPOINT as _EXCEPTION_ENDPOINT, ErrorBoundary as _ErrorBoundary } from "./ErrorBoundary";
import { _DJB2 as _DJB, _DJB2Object, _getSortedObject } from "./Hashing";
import { LogLevel as _LogLevel, Log as _Log } from "./Log";
import { MemoPrefix as _MemoPrefix, createMemoKey as _createMemoKey } from "./MemoKey";
import { Endpoint as _Endpoint, NetworkDefault as _NetworkDefault, NetworkParam as _NetworkParam } from "./NetworkConfig";
import { NetworkCore as _NetworkCore, RETRYABLE_CODES as _RETRYABLE_CODES } from "./NetworkCore";
import { _addDocumentEventListenerSafe, _addWindowEventListenerSafe, _cloneObject, _getCurrentPageUrlSafe, _getDocumentSafe, _getUnloadEvent, _getWindowSafe, _isServerEnv } from "./SafeJs";
import { SDKType as _SDKType } from "./SDKType";
import { SessionID as _SessionID, StatsigSession as _StatsigSession } from "./SessionID";
import { _fastApproxSizeOf } from "./SizeOf";
import { StableID as _StableID, getCookieName as _getCookieName } from "./StableID";
import { StatsigClientBase as _StatsigClientBase } from "./StatsigClientBase";
import { ErrorTag as _ErrorTag } from "./StatsigClientEventEmitter";
import { DataAdapterCachePrefix as _DataAdapterCachePrefix } from "./StatsigDataAdapter";
import { _createConfigExposure, _createGateExposure, _createLayerParameterExposure, _isExposureEvent, _mapExposures } from "./StatsigEvent";
import { SDK_VERSION as _SDK_VERSION, StatsigMetadataProvider as _StatsigMetadataProvider } from "./StatsigMetadata";
import { LogEventCompressionMode as _LogEventCompressionMode, LoggingEnabledOption as _LoggingEnabledOption } from "./StatsigOptionsCommon";
import { _makeDynamicConfig, _makeExperiment, _makeFeatureGate, _makeLayer, _makeTypedGet, _mergeOverride } from "./StatsigTypeFactories";
import { _getFullUserHash, _getUnitIDFromUser, _normalizeUser } from "./StatsigUser";
import { _getObjectFromStorage, _setObjectInStorage, Storage as _Storage } from "./StorageProvider";
import { _typedJsonParse } from "./TypedJsonParse";
import { _isTypeMatch, _typeOf } from "./TypingUtils";
import { UrlConfiguration as _UrlConfiguration } from "./UrlConfiguration";
import { getUUID as _getUUID } from "./UUID";
import { _isCurrentlyVisible, _isUnloading, _notifyVisibilityChanged, _subscribeToVisiblityChanged } from "./VisibilityObserving";
import { UPDATE_DETAIL_ERROR_MESSAGES as _UPDATE_DETAIL_ERROR_MESSAGES, createUpdateDetails as _createUpdateDetails } from "./StatsigUpdateDetails";
import { SDKFlags as _SDKFlags } from "./SDKFlags";
import { Diagnostics as _Diagnostics } from "./Diagnostics";
import { EventLogger as _EventLogger } from "./EventLogger";
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
/** Statsig Global should go first */
export { _Diagnostics as Diagnostics };
export { _EventLogger as EventLogger };
export { _Log as Log };
export { _Storage as Storage };
export { _getInstance, _getStatsigGlobal, _getStatsigGlobalFlag };
export { _getStorageKey, _getUserStorageKey };
export { _PrecomputedEvaluationsContextHandle as PrecomputedEvaluationsContextHandle };
export { _DataAdapterCore as DataAdapterCore, _makeDataAdapterResult };
export { _EXCEPTION_ENDPOINT as EXCEPTION_ENDPOINT, _ErrorBoundary as ErrorBoundary };
export { _DJB as _DJB2, _DJB2Object, _getSortedObject };
export { _LogLevel as LogLevel };
export { _MemoPrefix as MemoPrefix, _createMemoKey as createMemoKey };
export { _Endpoint as Endpoint, _NetworkDefault as NetworkDefault, _NetworkParam as NetworkParam };
export { _NetworkCore as NetworkCore, _RETRYABLE_CODES as RETRYABLE_CODES };
export { _addDocumentEventListenerSafe, _addWindowEventListenerSafe, _cloneObject, _getCurrentPageUrlSafe, _getDocumentSafe, _getUnloadEvent, _getWindowSafe, _isServerEnv };
export { _SDKType as SDKType };
export { _SessionID as SessionID, _StatsigSession as StatsigSession };
export { _fastApproxSizeOf };
export { _StableID as StableID, _getCookieName as getCookieName };
export { _StatsigClientBase as StatsigClientBase };
export { _ErrorTag as ErrorTag };
export { _DataAdapterCachePrefix as DataAdapterCachePrefix };
export { _createConfigExposure, _createGateExposure, _createLayerParameterExposure, _isExposureEvent, _mapExposures };
export { _SDK_VERSION as SDK_VERSION, _StatsigMetadataProvider as StatsigMetadataProvider };
export { _LogEventCompressionMode as LogEventCompressionMode, _LoggingEnabledOption as LoggingEnabledOption };
export { _makeDynamicConfig, _makeExperiment, _makeFeatureGate, _makeLayer, _makeTypedGet, _mergeOverride };
export { _getFullUserHash, _getUnitIDFromUser, _normalizeUser };
export { _getObjectFromStorage, _setObjectInStorage };
export { _typedJsonParse };
export { _isTypeMatch, _typeOf };
export { _UrlConfiguration as UrlConfiguration };
export { _getUUID as getUUID };
export { _isCurrentlyVisible, _isUnloading, _notifyVisibilityChanged, _subscribeToVisiblityChanged };
export { _UPDATE_DETAIL_ERROR_MESSAGES as UPDATE_DETAIL_ERROR_MESSAGES, _createUpdateDetails as createUpdateDetails };
export { _SDKFlags as SDKFlags };
Object.assign((0, _getStatsigGlobal)(), {
  Log: _Log,
  SDK_VERSION: _SDK_VERSION
});
const _cjs_default = {
  ["_getInstance"]: _getInstance,
  ["_getStatsigGlobal"]: _getStatsigGlobal,
  ["_getStatsigGlobalFlag"]: _getStatsigGlobalFlag,
  ["_getStorageKey"]: _getStorageKey,
  ["_getUserStorageKey"]: _getUserStorageKey,
  ["PrecomputedEvaluationsContextHandle"]: _PrecomputedEvaluationsContextHandle,
  ["DataAdapterCore"]: _DataAdapterCore,
  ["_makeDataAdapterResult"]: _makeDataAdapterResult,
  ["EXCEPTION_ENDPOINT"]: _EXCEPTION_ENDPOINT,
  ["ErrorBoundary"]: _ErrorBoundary,
  ["_DJB2"]: _DJB,
  ["_DJB2Object"]: _DJB2Object,
  ["_getSortedObject"]: _getSortedObject,
  ["LogLevel"]: _LogLevel,
  ["MemoPrefix"]: _MemoPrefix,
  ["createMemoKey"]: _createMemoKey,
  ["Endpoint"]: _Endpoint,
  ["NetworkDefault"]: _NetworkDefault,
  ["NetworkParam"]: _NetworkParam,
  ["NetworkCore"]: _NetworkCore,
  ["RETRYABLE_CODES"]: _RETRYABLE_CODES,
  ["_addDocumentEventListenerSafe"]: _addDocumentEventListenerSafe,
  ["_addWindowEventListenerSafe"]: _addWindowEventListenerSafe,
  ["_cloneObject"]: _cloneObject,
  ["_getCurrentPageUrlSafe"]: _getCurrentPageUrlSafe,
  ["_getDocumentSafe"]: _getDocumentSafe,
  ["_getUnloadEvent"]: _getUnloadEvent,
  ["_getWindowSafe"]: _getWindowSafe,
  ["_isServerEnv"]: _isServerEnv,
  ["SDKType"]: _SDKType,
  ["SessionID"]: _SessionID,
  ["StatsigSession"]: _StatsigSession,
  ["_fastApproxSizeOf"]: _fastApproxSizeOf,
  ["StableID"]: _StableID,
  ["getCookieName"]: _getCookieName,
  ["StatsigClientBase"]: _StatsigClientBase,
  ["ErrorTag"]: _ErrorTag,
  ["DataAdapterCachePrefix"]: _DataAdapterCachePrefix,
  ["_createConfigExposure"]: _createConfigExposure,
  ["_createGateExposure"]: _createGateExposure,
  ["_createLayerParameterExposure"]: _createLayerParameterExposure,
  ["_isExposureEvent"]: _isExposureEvent,
  ["_mapExposures"]: _mapExposures,
  ["SDK_VERSION"]: _SDK_VERSION,
  ["StatsigMetadataProvider"]: _StatsigMetadataProvider,
  ["LogEventCompressionMode"]: _LogEventCompressionMode,
  ["LoggingEnabledOption"]: _LoggingEnabledOption,
  ["_makeDynamicConfig"]: _makeDynamicConfig,
  ["_makeExperiment"]: _makeExperiment,
  ["_makeFeatureGate"]: _makeFeatureGate,
  ["_makeLayer"]: _makeLayer,
  ["_makeTypedGet"]: _makeTypedGet,
  ["_mergeOverride"]: _mergeOverride,
  ["_getFullUserHash"]: _getFullUserHash,
  ["_getUnitIDFromUser"]: _getUnitIDFromUser,
  ["_normalizeUser"]: _normalizeUser,
  ["_getObjectFromStorage"]: _getObjectFromStorage,
  ["_setObjectInStorage"]: _setObjectInStorage,
  ["_typedJsonParse"]: _typedJsonParse,
  ["_isTypeMatch"]: _isTypeMatch,
  ["_typeOf"]: _typeOf,
  ["UrlConfiguration"]: _UrlConfiguration,
  ["getUUID"]: _getUUID,
  ["_isCurrentlyVisible"]: _isCurrentlyVisible,
  ["_isUnloading"]: _isUnloading,
  ["_notifyVisibilityChanged"]: _notifyVisibilityChanged,
  ["_subscribeToVisiblityChanged"]: _subscribeToVisiblityChanged,
  ["UPDATE_DETAIL_ERROR_MESSAGES"]: _UPDATE_DETAIL_ERROR_MESSAGES,
  ["createUpdateDetails"]: _createUpdateDetails,
  ["SDKFlags"]: _SDKFlags,
  ["Diagnostics"]: _Diagnostics,
  ["EventLogger"]: _EventLogger,
  ["Log"]: _Log,
  ["Storage"]: _Storage
};
export default _cjs_default;
