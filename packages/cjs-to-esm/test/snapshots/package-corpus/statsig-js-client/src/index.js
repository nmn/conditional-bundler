import { DataAdapterCachePrefix as _DataAdapterCachePrefix, DataAdapterCore as _DataAdapterCore, Diagnostics as _Diagnostics, EXCEPTION_ENDPOINT as _EXCEPTION_ENDPOINT, Endpoint as _Endpoint, ErrorBoundary as _ErrorBoundary, ErrorTag as _ErrorTag, EventLogger as _EventLogger, Log as _Log, LogEventCompressionMode as _LogEventCompressionMode, LogLevel as _LogLevel, LoggingEnabledOption as _LoggingEnabledOption, MemoPrefix as _MemoPrefix, NetworkCore as _NetworkCore, NetworkDefault as _NetworkDefault, NetworkParam as _NetworkParam, PrecomputedEvaluationsContextHandle as _PrecomputedEvaluationsContextHandle, RETRYABLE_CODES as _RETRYABLE_CODES, SDKFlags as _SDKFlags, SDKType as _SDKType, SDK_VERSION as _SDK_VERSION, SessionID as _SessionID, StableID as _StableID, StatsigClientBase as _StatsigClientBase, StatsigMetadataProvider as _StatsigMetadataProvider, StatsigSession as _StatsigSession, Storage as _Storage, UPDATE_DETAIL_ERROR_MESSAGES as _UPDATE_DETAIL_ERROR_MESSAGES, UrlConfiguration as _UrlConfiguration, _DJB2 as _DJB, _DJB2Object, _addDocumentEventListenerSafe, _addWindowEventListenerSafe, _cloneObject, _createConfigExposure, _createGateExposure, _createLayerParameterExposure, _fastApproxSizeOf, _getCurrentPageUrlSafe, _getDocumentSafe, _getFullUserHash, _getInstance, _getObjectFromStorage, _getSortedObject, _getStatsigGlobal, _getStatsigGlobalFlag, _getStorageKey, _getUnitIDFromUser, _getUnloadEvent, _getUserStorageKey, _getWindowSafe, _isCurrentlyVisible, _isExposureEvent, _isServerEnv, _isTypeMatch, _isUnloading, _makeDataAdapterResult, _makeDynamicConfig, _makeExperiment, _makeFeatureGate, _makeLayer, _makeTypedGet, _mapExposures, _mergeOverride, _normalizeUser, _notifyVisibilityChanged, _setObjectInStorage, _subscribeToVisiblityChanged, _typeOf, _typedJsonParse, createMemoKey as _createMemoKey, createUpdateDetails as _createUpdateDetails, getCookieName as _getCookieName, getUUID as _getUUID } from "@statsig/client-core";
import StatsigClient_1 from "./StatsigClient";
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
const _StatsigClient = StatsigClient_1.default;
export { _StatsigClient as StatsigClient };
export { _DataAdapterCachePrefix as DataAdapterCachePrefix, _DataAdapterCore as DataAdapterCore, _Diagnostics as Diagnostics, _EXCEPTION_ENDPOINT as EXCEPTION_ENDPOINT, _Endpoint as Endpoint, _ErrorBoundary as ErrorBoundary, _ErrorTag as ErrorTag, _EventLogger as EventLogger, _Log as Log, _LogEventCompressionMode as LogEventCompressionMode, _LogLevel as LogLevel, _LoggingEnabledOption as LoggingEnabledOption, _MemoPrefix as MemoPrefix, _NetworkCore as NetworkCore, _NetworkDefault as NetworkDefault, _NetworkParam as NetworkParam, _PrecomputedEvaluationsContextHandle as PrecomputedEvaluationsContextHandle, _RETRYABLE_CODES as RETRYABLE_CODES, _SDKFlags as SDKFlags, _SDKType as SDKType, _SDK_VERSION as SDK_VERSION, _SessionID as SessionID, _StableID as StableID, _StatsigClientBase as StatsigClientBase, _StatsigMetadataProvider as StatsigMetadataProvider, _StatsigSession as StatsigSession, _Storage as Storage, _UPDATE_DETAIL_ERROR_MESSAGES as UPDATE_DETAIL_ERROR_MESSAGES, _UrlConfiguration as UrlConfiguration, _DJB as _DJB2, _DJB2Object, _addDocumentEventListenerSafe, _addWindowEventListenerSafe, _cloneObject, _createConfigExposure, _createGateExposure, _createLayerParameterExposure, _fastApproxSizeOf, _getCurrentPageUrlSafe, _getDocumentSafe, _getFullUserHash, _getInstance, _getObjectFromStorage, _getSortedObject, _getStatsigGlobal, _getStatsigGlobalFlag, _getStorageKey, _getUnitIDFromUser, _getUnloadEvent, _getUserStorageKey, _getWindowSafe, _isCurrentlyVisible, _isExposureEvent, _isServerEnv, _isTypeMatch, _isUnloading, _makeDataAdapterResult, _makeDynamicConfig, _makeExperiment, _makeFeatureGate, _makeLayer, _makeTypedGet, _mapExposures, _mergeOverride, _normalizeUser, _notifyVisibilityChanged, _setObjectInStorage, _subscribeToVisiblityChanged, _typeOf, _typedJsonParse, _createMemoKey as createMemoKey, _createUpdateDetails as createUpdateDetails, _getCookieName as getCookieName, _getUUID as getUUID };
const __STATSIG__ = Object.assign((0, _getStatsigGlobal)(), {
  StatsigClient: StatsigClient_1.default
});
const _cjs_default = {
  ["DataAdapterCachePrefix"]: _DataAdapterCachePrefix,
  ["DataAdapterCore"]: _DataAdapterCore,
  ["Diagnostics"]: _Diagnostics,
  ["EXCEPTION_ENDPOINT"]: _EXCEPTION_ENDPOINT,
  ["Endpoint"]: _Endpoint,
  ["ErrorBoundary"]: _ErrorBoundary,
  ["ErrorTag"]: _ErrorTag,
  ["EventLogger"]: _EventLogger,
  ["Log"]: _Log,
  ["LogEventCompressionMode"]: _LogEventCompressionMode,
  ["LogLevel"]: _LogLevel,
  ["LoggingEnabledOption"]: _LoggingEnabledOption,
  ["MemoPrefix"]: _MemoPrefix,
  ["NetworkCore"]: _NetworkCore,
  ["NetworkDefault"]: _NetworkDefault,
  ["NetworkParam"]: _NetworkParam,
  ["PrecomputedEvaluationsContextHandle"]: _PrecomputedEvaluationsContextHandle,
  ["RETRYABLE_CODES"]: _RETRYABLE_CODES,
  ["SDKFlags"]: _SDKFlags,
  ["SDKType"]: _SDKType,
  ["SDK_VERSION"]: _SDK_VERSION,
  ["SessionID"]: _SessionID,
  ["StableID"]: _StableID,
  ["StatsigClientBase"]: _StatsigClientBase,
  ["StatsigMetadataProvider"]: _StatsigMetadataProvider,
  ["StatsigSession"]: _StatsigSession,
  ["Storage"]: _Storage,
  ["UPDATE_DETAIL_ERROR_MESSAGES"]: _UPDATE_DETAIL_ERROR_MESSAGES,
  ["UrlConfiguration"]: _UrlConfiguration,
  ["_DJB2"]: _DJB,
  ["_DJB2Object"]: _DJB2Object,
  ["_addDocumentEventListenerSafe"]: _addDocumentEventListenerSafe,
  ["_addWindowEventListenerSafe"]: _addWindowEventListenerSafe,
  ["_cloneObject"]: _cloneObject,
  ["_createConfigExposure"]: _createConfigExposure,
  ["_createGateExposure"]: _createGateExposure,
  ["_createLayerParameterExposure"]: _createLayerParameterExposure,
  ["_fastApproxSizeOf"]: _fastApproxSizeOf,
  ["_getCurrentPageUrlSafe"]: _getCurrentPageUrlSafe,
  ["_getDocumentSafe"]: _getDocumentSafe,
  ["_getFullUserHash"]: _getFullUserHash,
  ["_getInstance"]: _getInstance,
  ["_getObjectFromStorage"]: _getObjectFromStorage,
  ["_getSortedObject"]: _getSortedObject,
  ["_getStatsigGlobal"]: _getStatsigGlobal,
  ["_getStatsigGlobalFlag"]: _getStatsigGlobalFlag,
  ["_getStorageKey"]: _getStorageKey,
  ["_getUnitIDFromUser"]: _getUnitIDFromUser,
  ["_getUnloadEvent"]: _getUnloadEvent,
  ["_getUserStorageKey"]: _getUserStorageKey,
  ["_getWindowSafe"]: _getWindowSafe,
  ["_isCurrentlyVisible"]: _isCurrentlyVisible,
  ["_isExposureEvent"]: _isExposureEvent,
  ["_isServerEnv"]: _isServerEnv,
  ["_isTypeMatch"]: _isTypeMatch,
  ["_isUnloading"]: _isUnloading,
  ["_makeDataAdapterResult"]: _makeDataAdapterResult,
  ["_makeDynamicConfig"]: _makeDynamicConfig,
  ["_makeExperiment"]: _makeExperiment,
  ["_makeFeatureGate"]: _makeFeatureGate,
  ["_makeLayer"]: _makeLayer,
  ["_makeTypedGet"]: _makeTypedGet,
  ["_mapExposures"]: _mapExposures,
  ["_mergeOverride"]: _mergeOverride,
  ["_normalizeUser"]: _normalizeUser,
  ["_notifyVisibilityChanged"]: _notifyVisibilityChanged,
  ["_setObjectInStorage"]: _setObjectInStorage,
  ["_subscribeToVisiblityChanged"]: _subscribeToVisiblityChanged,
  ["_typeOf"]: _typeOf,
  ["_typedJsonParse"]: _typedJsonParse,
  ["createMemoKey"]: _createMemoKey,
  ["createUpdateDetails"]: _createUpdateDetails,
  ["getCookieName"]: _getCookieName,
  ["getUUID"]: _getUUID,
  ["StatsigClient"]: _StatsigClient,
  ["default"]: __STATSIG__
};
export default _cjs_default;
