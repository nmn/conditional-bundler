import { BatchQueue as _BatchQueue } from "./BatchedEventsQueue";
import { _getUserStorageKey } from "./CacheKey";
import { EventRetryConstants as _EventRetryConstants } from "./EventRetryConstants";
import { FlushCoordinator as _FlushCoordinator } from "./FlushCoordinator";
import { _DJB2 as _DJB } from "./Hashing";
import { Log as _Log } from "./Log";
import { Endpoint as _Endpoint } from "./NetworkConfig";
import { PendingEvents as _PendingEvents } from "./PendingEvents";
import { _isServerEnv, _getCurrentPageUrlSafe } from "./SafeJs";
import { _isExposureEvent } from "./StatsigEvent";
import { LoggingEnabledOption as _LoggingEnabledOption } from "./StatsigOptionsCommon";
import { _setObjectInStorage, _getObjectFromStorage, Storage as _Storage } from "./StorageProvider";
import { UrlConfiguration as _UrlConfiguration } from "./UrlConfiguration";
import { _subscribeToVisiblityChanged } from "./VisibilityObserving";
var __awaiter = this && this.__awaiter || function (thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function (resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function (resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
const MAX_DEDUPER_KEYS = 1000;
const DEDUPER_WINDOW_DURATION_MS = 600000;
const EVENT_LOGGER_MAP = {};
export class EventLogger {
  static _safeFlushAndForget(sdkKey) {
    var _a;
    (_a = EVENT_LOGGER_MAP[sdkKey]) === null || _a === void 0 ? void 0 : _a.flush().catch(() => {
      // noop
    });
  }
  constructor(_sdkKey, _emitter, _network, _options, _errorBoundary) {
    var _a;
    this._sdkKey = _sdkKey;
    this._emitter = _emitter;
    this._network = _network;
    this._options = _options;
    this._errorBoundary = _errorBoundary;
    this._pendingEvents = null;
    this._batchQueue = null;
    this._flushCoordinator = null;
    this._lastExposureTimeMap = {};
    this._nonExposedChecks = {};
    this._isShuttingDown = false;
    this._storageKey = null;
    this._pendingCompressionMode = null;
    this._loggingEnabled = (_a = _options === null || _options === void 0 ? void 0 : _options.loggingEnabled) !== null && _a !== void 0 ? _a : (_options === null || _options === void 0 ? void 0 : _options.disableLogging) === true ? _LoggingEnabledOption.disabled : _LoggingEnabledOption.browserOnly;
    if ((_options === null || _options === void 0 ? void 0 : _options.loggingEnabled) && _options.disableLogging !== undefined) {
      _Log.warn('Detected both loggingEnabled and disableLogging options. loggingEnabled takes precedence - please remove disableLogging.');
    }
    const config = _options === null || _options === void 0 ? void 0 : _options.networkConfig;
    this._logEventUrlConfig = new _UrlConfiguration(_Endpoint._rgstr, config === null || config === void 0 ? void 0 : config.logEventUrl, config === null || config === void 0 ? void 0 : config.api, config === null || config === void 0 ? void 0 : config.logEventFallbackUrls);
  }
  setLogEventCompressionMode(mode) {
    if (this._flushCoordinator) {
      this._flushCoordinator.setLogEventCompressionMode(mode);
    } else {
      this._pendingCompressionMode = mode;
    }
  }
  setLoggingEnabled(loggingEnabled) {
    const wasDisabled = this._loggingEnabled === 'disabled';
    const isNowEnabled = loggingEnabled !== 'disabled';
    this._loggingEnabled = loggingEnabled;
    if (this._flushCoordinator) {
      this._flushCoordinator.setLoggingEnabled(loggingEnabled);
    }
    if (wasDisabled && isNowEnabled) {
      const events = this._loadStoredEvents();
      _Log.debug(`Loaded ${events.length} stored event(s) from storage`);
      if (events.length > 0) {
        events.forEach(event => {
          this._initFlushCoordinator().addEvent(event);
        });
        this.flush().catch(error => {
          _Log.warn('Failed to flush events after enabling logging:', error);
        });
      }
    }
  }
  enqueue(event) {
    var _a;
    if (!this._shouldLogEvent(event)) {
      return;
    }
    const normalizedEvent = this._normalizeEvent(event);
    if (this._loggingEnabled === 'disabled') {
      this._storeEventToStorage(normalizedEvent);
      return;
    }
    this._initFlushCoordinator().addEvent(normalizedEvent);
    (_a = this._flushCoordinator) === null || _a === void 0 ? void 0 : _a.checkQuickFlush();
  }
  incrementNonExposureCount(name) {
    var _a;
    const current = (_a = this._nonExposedChecks[name]) !== null && _a !== void 0 ? _a : 0;
    this._nonExposedChecks[name] = current + 1;
  }
  reset() {
    // attempt to flush any remaining events
    this.flush().catch(() => {
      // noop
    });
    this._lastExposureTimeMap = {};
  }
  start() {
    var _a;
    const isServerEnv = (0, _isServerEnv)();
    if (isServerEnv && ((_a = this._options) === null || _a === void 0 ? void 0 : _a.loggingEnabled) !== 'always') {
      return;
    }
    const flushCoordinator = this._initFlushCoordinator();
    EVENT_LOGGER_MAP[this._sdkKey] = this;
    if (!isServerEnv) {
      (0, _subscribeToVisiblityChanged)(visibility => {
        if (visibility === 'background') {
          EventLogger._safeFlushAndForget(this._sdkKey);
        } else if (visibility === 'foreground') {
          flushCoordinator.startScheduledFlushCycle();
        }
      });
    }
    flushCoordinator.loadAndRetryShutdownFailedEvents().catch(error => {
      _Log.warn('Failed to load failed shutdown events:', error);
    });
    flushCoordinator.startScheduledFlushCycle();
  }
  stop() {
    return __awaiter(this, void 0, void 0, function* () {
      this._isShuttingDown = true;
      if (this._flushCoordinator) {
        yield this._flushCoordinator.processShutdown();
      }
      delete EVENT_LOGGER_MAP[this._sdkKey];
      this._flushCoordinator = null;
      this._pendingEvents = null;
      this._batchQueue = null;
    });
  }
  flush() {
    return __awaiter(this, void 0, void 0, function* () {
      if (!this._flushCoordinator) {
        return;
      }
      return this._flushCoordinator.processManualFlush();
    });
  }
  appendAndResetNonExposedChecks() {
    if (Object.keys(this._nonExposedChecks).length === 0) {
      return;
    }
    const checks = Object.assign({}, this._nonExposedChecks);
    this._nonExposedChecks = {};
    const event = this._normalizeEvent({
      eventName: 'statsig::non_exposed_checks',
      user: null,
      time: Date.now(),
      metadata: {
        checks
      }
    });
    if (!this._flushCoordinator) {
      return;
    }
    this._flushCoordinator.addEvent(event);
  }
  _shouldLogEvent(event) {
    var _a;
    if (((_a = this._options) === null || _a === void 0 ? void 0 : _a.loggingEnabled) !== 'always' && (0, _isServerEnv)()) {
      return false;
    }
    if (!(0, _isExposureEvent)(event)) {
      return true;
    }
    const user = event.user ? event.user : {
      statsigEnvironment: undefined
    };
    const userKey = (0, _getUserStorageKey)(this._sdkKey, user);
    const metadata = event.metadata ? event.metadata : {};
    const key = [event.eventName, userKey, metadata['gate'], metadata['config'], metadata['ruleID'], metadata['allocatedExperiment'], metadata['parameterName'], String(metadata['isExplicitParameter']), metadata['reason']].join('|');
    const previous = this._lastExposureTimeMap[key];
    const now = Date.now();
    if (previous && now - previous < DEDUPER_WINDOW_DURATION_MS) {
      return false;
    }
    if (Object.keys(this._lastExposureTimeMap).length > MAX_DEDUPER_KEYS) {
      this._lastExposureTimeMap = {};
    }
    this._lastExposureTimeMap[key] = now;
    return true;
  }
  _getCurrentPageUrl() {
    var _a;
    if (((_a = this._options) === null || _a === void 0 ? void 0 : _a.includeCurrentPageUrlWithEvents) === false) {
      return;
    }
    return (0, _getCurrentPageUrlSafe)();
  }
  _getStorageKey() {
    if (!this._storageKey) {
      this._storageKey = `statsig.pending_events.${(0, _DJB)(this._sdkKey)}`;
    }
    return this._storageKey;
  }
  _initFlushCoordinator() {
    var _a, _b;
    if (this._flushCoordinator) {
      return this._flushCoordinator;
    }
    const batchSize = (_b = (_a = this._options) === null || _a === void 0 ? void 0 : _a.loggingBufferMaxSize) !== null && _b !== void 0 ? _b : _EventRetryConstants.DEFAULT_BATCH_SIZE;
    this._pendingEvents = new _PendingEvents(batchSize);
    this._batchQueue = new _BatchQueue(batchSize);
    this._flushCoordinator = new _FlushCoordinator(this._batchQueue, this._pendingEvents, () => this.appendAndResetNonExposedChecks(), this._sdkKey, this._network, this._emitter, this._logEventUrlConfig, this._options, this._loggingEnabled, this._errorBoundary);
    if (this._pendingCompressionMode) {
      this._flushCoordinator.setLogEventCompressionMode(this._pendingCompressionMode);
      this._pendingCompressionMode = null;
    }
    return this._flushCoordinator;
  }
  _storeEventToStorage(event) {
    const storageKey = this._getStorageKey();
    try {
      let existingEvents = this._getEventsFromStorage(storageKey);
      existingEvents.push(event);
      if (existingEvents.length > _EventRetryConstants.MAX_LOCAL_STORAGE) {
        existingEvents = existingEvents.slice(-_EventRetryConstants.MAX_LOCAL_STORAGE);
      }
      (0, _setObjectInStorage)(storageKey, existingEvents);
    } catch (error) {
      _Log.warn('Unable to save events to storage');
    }
  }
  _getEventsFromStorage(storageKey) {
    try {
      const events = (0, _getObjectFromStorage)(storageKey);
      if (Array.isArray(events)) {
        return events;
      }
      return [];
    } catch (_a) {
      return [];
    }
  }
  _loadStoredEvents() {
    const storageKey = this._getStorageKey();
    const events = this._getEventsFromStorage(storageKey);
    if (events.length > 0) {
      _Storage.removeItem(storageKey);
    }
    return events;
  }
  _normalizeEvent(event) {
    if (event.user) {
      event.user = Object.assign({}, event.user);
      delete event.user.privateAttributes;
    }
    const extras = {};
    const currentPage = this._getCurrentPageUrl();
    if (currentPage) {
      extras.statsigMetadata = {
        currentPage
      };
    }
    return Object.assign(Object.assign({}, event), extras);
  }
}
const _cjs_default = {
  ["EventLogger"]: EventLogger
};
export default _cjs_default;
