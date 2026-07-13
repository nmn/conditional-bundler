import { _getStatsigGlobal } from "./$_StatsigGlobal";
import { ErrorBoundary as _ErrorBoundary } from "./ErrorBoundary";
import { EventLogger as _EventLogger } from "./EventLogger";
import { Log as _Log } from "./Log";
import { createMemoKey as _createMemoKey } from "./MemoKey";
import { _isServerEnv } from "./SafeJs";
import { StatsigSession as _StatsigSession } from "./SessionID";
import { StableID as _StableID } from "./StableID";
import { LogEventCompressionMode as _LogEventCompressionMode } from "./StatsigOptionsCommon";
import { Storage as _Storage } from "./StorageProvider";
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
const MAX_MEMO_CACHE_SIZE = 3000;
export class StatsigClientBase {
  constructor(sdkKey, adapter, network, options) {
    var _a, _b, _c, _d;
    this.loadingStatus = 'Uninitialized';
    this._initializePromise = null;
    this._listeners = {};
    const emitter = this.$emt.bind(this);
    (options === null || options === void 0 ? void 0 : options.logLevel) != null && (_Log.level = options.logLevel);
    (options === null || options === void 0 ? void 0 : options.disableStorage) && _Storage._setDisabled(true);
    (options === null || options === void 0 ? void 0 : options.initialSessionID) && _StatsigSession.overrideInitialSessionID(options.initialSessionID, sdkKey);
    (options === null || options === void 0 ? void 0 : options.storageProvider) && _Storage._setProvider(options.storageProvider);
    (options === null || options === void 0 ? void 0 : options.enableCookies) && _StableID._setCookiesEnabled(sdkKey, options.enableCookies);
    (options === null || options === void 0 ? void 0 : options.disableStableID) && _StableID._setDisabled(sdkKey, true);
    this._sdkKey = sdkKey;
    this._options = options !== null && options !== void 0 ? options : {};
    this._memoCache = {};
    this.overrideAdapter = (_a = options === null || options === void 0 ? void 0 : options.overrideAdapter) !== null && _a !== void 0 ? _a : null;
    this._errorBoundary = new _ErrorBoundary(sdkKey, options, emitter);
    this._logger = new _EventLogger(sdkKey, emitter, network, options, this._errorBoundary);
    this._errorBoundary.wrap(this);
    this._errorBoundary.wrap(adapter);
    this._errorBoundary.wrap(this._logger);
    network.setErrorBoundary(this._errorBoundary);
    this.dataAdapter = adapter;
    this.dataAdapter.attach(sdkKey, options, network);
    this.storageProvider = _Storage;
    (_d = (_c = (_b = this.overrideAdapter) === null || _b === void 0 ? void 0 : _b.loadFromStorage) === null || _c === void 0 ? void 0 : _c.call(_b)) === null || _d === void 0 ? void 0 : _d.catch(e => this._errorBoundary.logError('OA::loadFromStorage', e));
    this._primeReadyRipcord();
    _assignGlobalInstance(sdkKey, this);
  }
  /**
   * Updates runtime configuration options for the SDK, allowing toggling of certain behaviors such as logging and storage to comply with user preferences or regulations such as GDPR.
   *
   * @param {StatsigRuntimeMutableOptions} options - The configuration options that dictate the runtime behavior of the SDK.
   */
  updateRuntimeOptions(options) {
    if (options.loggingEnabled) {
      this._options.loggingEnabled = options.loggingEnabled;
      this._logger.setLoggingEnabled(options.loggingEnabled);
    } else if (options.disableLogging != null) {
      this._options.disableLogging = options.disableLogging;
      this._logger.setLoggingEnabled(options.disableLogging ? 'disabled' : 'browser-only');
    }
    if (options.disableStorage != null) {
      this._options.disableStorage = options.disableStorage;
      _Storage._setDisabled(options.disableStorage);
    }
    if (options.enableCookies != null) {
      this._options.enableCookies = options.enableCookies;
      _StableID._setCookiesEnabled(this._sdkKey, options.enableCookies);
    }
    if (options.logEventCompressionMode) {
      this._logger.setLogEventCompressionMode(options.logEventCompressionMode);
    } else if (options.disableCompression) {
      this._logger.setLogEventCompressionMode(_LogEventCompressionMode.Disabled);
    }
  }
  /**
   * Flushes any currently queued events.
   */
  flush() {
    return this._logger.flush();
  }
  /**
   * Gracefully shuts down the SDK, ensuring that all pending events are send before the SDK stops.
   * This function emits a 'pre_shutdown' event and then waits for the logger to complete its shutdown process.
   *
   * @returns {Promise<void>} A promise that resolves when all shutdown procedures, including logging shutdown, have been completed.
   */
  shutdown() {
    return __awaiter(this, void 0, void 0, function* () {
      this.$emt({
        name: 'pre_shutdown'
      });
      this._setStatus('Uninitialized', null);
      this._initializePromise = null;
      yield this._logger.stop();
    });
  }
  /**
   * Subscribes a callback function to a specific {@link StatsigClientEvent} or all StatsigClientEvents if the wildcard '*' is used.
   * Once subscribed, the listener callback will be invoked whenever the specified event is emitted.
   *
   * @param {StatsigClientEventName} event - The name of the event to subscribe to, or '*' to subscribe to all events.
   * @param {StatsigClientEventCallback<T>} listener - The callback function to execute when the event occurs. The function receives event-specific data as its parameter.
   * @see {@link off} for unsubscribing from events.
   */
  on(event, listener) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(listener);
  }
  /**
   * Unsubscribes a previously registered callback function from a specific {@link StatsigClientEvent} or all StatsigClientEvents if the wildcard '*' is used.
   *
   * @param {StatsigClientEventName} event - The name of the event from which to unsubscribe, or '*' to unsubscribe from all events.
   * @param {StatsigClientEventCallback<T>} listener - The callback function to remove from the event's notification list.
   * @see {@link on} for subscribing to events.
   */
  off(event, listener) {
    if (this._listeners[event]) {
      const index = this._listeners[event].indexOf(listener);
      if (index !== -1) {
        this._listeners[event].splice(index, 1);
      }
    }
  }
  $on(event, listener) {
    listener.__isInternal = true;
    this.on(event, listener);
  }
  $emt(event) {
    var _a;
    const barrier = listener => {
      try {
        listener(event);
      } catch (error) {
        if (listener.__isInternal === true) {
          this._errorBoundary.logError(`__emit:${event.name}`, error);
          return;
        }
        _Log.error(`An error occurred in a StatsigClientEvent listener. This is not an issue with Statsig.`, event);
      }
    };
    if (this._listeners[event.name]) {
      this._listeners[event.name].forEach(l => barrier(l));
    }
    (_a = this._listeners['*']) === null || _a === void 0 ? void 0 : _a.forEach(barrier);
  }
  _setStatus(newStatus, values) {
    this.loadingStatus = newStatus;
    this._memoCache = {};
    this.$emt({
      name: 'values_updated',
      status: newStatus,
      values
    });
  }
  _enqueueExposure(name, exposure, options) {
    if ((options === null || options === void 0 ? void 0 : options.disableExposureLog) === true) {
      this._logger.incrementNonExposureCount(name);
      return;
    }
    this._logger.enqueue(exposure);
  }
  _memoize(prefix, fn) {
    return (name, options) => {
      if (this._options.disableEvaluationMemoization) {
        return fn(name, options);
      }
      const memoKey = (0, _createMemoKey)(prefix, name, options);
      if (!memoKey) {
        return fn(name, options);
      }
      if (!(memoKey in this._memoCache)) {
        if (Object.keys(this._memoCache).length >= MAX_MEMO_CACHE_SIZE) {
          this._memoCache = {};
        }
        this._memoCache[memoKey] = fn(name, options);
      }
      return this._memoCache[memoKey];
    };
  }
}
function _assignGlobalInstance(sdkKey, client) {
  var _a;
  if ((0, _isServerEnv)()) {
    return;
  }
  const statsigGlobal = (0, _getStatsigGlobal)();
  const instances = (_a = statsigGlobal.instances) !== null && _a !== void 0 ? _a : {};
  const inst = client;
  if (instances[sdkKey] != null) {
    _Log.warn('Creating multiple Statsig clients with the same SDK key can lead to unexpected behavior. Multi-instance support requires different SDK keys.');
  }
  instances[sdkKey] = inst;
  if (!statsigGlobal.firstInstance) {
    statsigGlobal.firstInstance = inst;
  }
  statsigGlobal.instances = instances;
  __STATSIG__ = statsigGlobal;
}
const _cjs_default = {
  ["StatsigClientBase"]: StatsigClientBase
};
export default _cjs_default;
