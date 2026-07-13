import { EventRetryConstants as _EventRetryConstants } from "./EventRetryConstants";
import { EventSender as _EventSender } from "./EventSender";
import { FlushInterval as _FlushInterval } from "./FlushInterval";
import { FlushTypeValues as _FlushTypeValues } from "./FlushTypes";
import { _DJB2 as _DJB } from "./Hashing";
import { Log as _Log } from "./Log";
import { RETRYABLE_CODES as _RETRYABLE_CODES } from "./NetworkCore";
import { _isServerEnv } from "./SafeJs";
import { StatsigSession as _StatsigSession } from "./SessionID";
import { LoggingEnabledOption as _LoggingEnabledOption } from "./StatsigOptionsCommon";
import { Storage as _Storage, _setObjectInStorage, _getObjectFromStorage } from "./StorageProvider";
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
const RETRYABLE_NO_RESPONSE_FAILURE_PATHS = new Set(['network_request_timed_out_no_response', 'network_request_exception_no_response', 'event_sender_post_returned_null', 'event_sender_post_returned_undefined', 'event_sender_post_exception']);
export class FlushCoordinator {
  constructor(batchQueue, pendingEvents, onPrepareFlush,
  // For Event Sender
  sdkKey, network, emitter, logEventUrlConfig, options, loggingEnabled, errorBoundary) {
    this._cooldownTimer = null;
    this._maxIntervalTimer = null;
    this._hasRunQuickFlush = false;
    this._currentFlushPromise = null;
    this._creationTime = Date.now();
    this._isShuttingDown = false;
    this._storageKey = null;
    this._flushInterval = new _FlushInterval();
    this._batchQueue = batchQueue;
    this._pendingEvents = pendingEvents;
    this._onPrepareFlush = onPrepareFlush;
    this._errorBoundary = errorBoundary;
    this._sdkKey = sdkKey;
    this._loggingEnabled = loggingEnabled;
    this._eventSender = new _EventSender(sdkKey, network, emitter, logEventUrlConfig, options);
  }
  setLoggingEnabled(loggingEnabled) {
    this._loggingEnabled = loggingEnabled;
  }
  setLogEventCompressionMode(mode) {
    this._eventSender.setLogEventCompressionMode(mode);
  }
  startScheduledFlushCycle() {
    this._scheduleNextFlush();
  }
  stopScheduledFlushCycle() {
    this._clearAllTimers();
  }
  addEvent(event) {
    this._pendingEvents.addToPendingEventsQueue(event);
    if (this._currentFlushPromise) {
      return;
    }
    if (this._pendingEvents.hasEventsForFullBatch()) {
      this.processLimitFlush();
    }
  }
  processManualFlush() {
    return __awaiter(this, void 0, void 0, function* () {
      if (this._currentFlushPromise) {
        yield this._currentFlushPromise;
      }
      this._currentFlushPromise = this._executeFlush(_FlushTypeValues.Manual).finally(() => {
        this._currentFlushPromise = null;
        this._scheduleNextFlush();
      });
      return this._currentFlushPromise;
    });
  }
  processShutdown() {
    return __awaiter(this, void 0, void 0, function* () {
      this._isShuttingDown = true;
      this._clearAllTimers();
      if (this._currentFlushPromise) {
        yield this._currentFlushPromise;
      }
      this._currentFlushPromise = this._executeFlush(_FlushTypeValues.Shutdown).catch(error => {
        _Log.error(`Error during shutdown flush: ${error}`);
      }).finally(() => {
        this._currentFlushPromise = null;
      });
      return this._currentFlushPromise;
    });
  }
  _executeFlush(flushType) {
    return __awaiter(this, void 0, void 0, function* () {
      this._clearAllTimers();
      try {
        this._prepareQueueForFlush(flushType);
        const batches = this._batchQueue.takeAllBatches();
        if (batches.length === 0) {
          return;
        }
        yield Promise.all(batches.map(batch => this._processOneBatch(batch, flushType)));
      } finally {
        if (!this._isShuttingDown) {
          this._scheduleNextFlush();
        }
      }
    });
  }
  checkQuickFlush() {
    if (this._hasRunQuickFlush) {
      return;
    }
    if (Date.now() - this._creationTime > _EventRetryConstants.QUICK_FLUSH_WINDOW_MS) {
      return;
    }
    this._hasRunQuickFlush = true;
    setTimeout(() => {
      this.processManualFlush().catch(error => {
        _Log.warn('Quick flush failed:', error);
      });
    }, _EventRetryConstants.QUICK_FLUSH_WINDOW_MS);
  }
  _attemptScheduledFlush() {
    if (this._currentFlushPromise) {
      this._scheduleNextFlush();
      return;
    }
    const shouldFlushBySize = this.containsAtLeastOneFullBatch();
    const shouldFlushByTime = this._flushInterval.hasReachedMaxInterval();
    if (!shouldFlushBySize && !shouldFlushByTime) {
      this._scheduleNoopPollTick();
      return;
    }
    this._flushInterval.markFlushAttempt();
    let flushType;
    if (shouldFlushBySize) {
      flushType = _FlushTypeValues.ScheduledFullBatch;
    } else {
      flushType = _FlushTypeValues.ScheduledMaxTime;
    }
    this._currentFlushPromise = this._processNextBatch(flushType).then(() => {
      //This discards boolean result. Main goal here is to track completion
    }).catch(error => {
      _Log.error('Error during scheduled flush:', error);
    }).finally(() => {
      this._currentFlushPromise = null;
      this._scheduleNextFlush();
    });
  }
  processLimitFlush() {
    if (!this._flushInterval.hasCompletelyRecoveredFromBackoff()) {
      return;
    }
    if (this._currentFlushPromise) {
      return;
    }
    this._currentFlushPromise = this._processLimitFlushInternal().catch(error => {
      _Log.error(`Error during limit flush`, error);
    }).finally(() => {
      this._currentFlushPromise = null;
      this._scheduleNextFlush();
    });
  }
  _processLimitFlushInternal() {
    return __awaiter(this, void 0, void 0, function* () {
      const success = yield this._processNextBatch(_FlushTypeValues.Limit);
      if (!success) {
        return;
      }
      while (this._flushInterval.hasCompletelyRecoveredFromBackoff() && this.containsAtLeastOneFullBatch()) {
        const success = yield this._processNextBatch(_FlushTypeValues.Limit);
        if (!success) {
          break;
        }
      }
    });
  }
  _scheduleNextFlush() {
    this._clearAllTimers();
    if (this._isShuttingDown) {
      return;
    }
    const cooldownDelay = Math.max(0, this._flushInterval.getTimeUntilNextFlush());
    this._cooldownTimer = setTimeout(() => {
      this._cooldownTimer = null;
      _StatsigSession.checkForIdleSession(this._sdkKey);
      this._attemptScheduledFlush();
    }, cooldownDelay);
    const maxIntervalDelay = Math.max(0, this._flushInterval.getTimeTillMaxInterval());
    this._maxIntervalTimer = setTimeout(() => {
      this._maxIntervalTimer = null;
      _StatsigSession.checkForIdleSession(this._sdkKey);
      this._attemptScheduledFlush();
    }, maxIntervalDelay);
  }
  _clearAllTimers() {
    if (this._cooldownTimer !== null) {
      clearTimeout(this._cooldownTimer);
      this._cooldownTimer = null;
    }
    if (this._maxIntervalTimer !== null) {
      clearTimeout(this._maxIntervalTimer);
      this._maxIntervalTimer = null;
    }
  }
  _scheduleNoopPollTick() {
    this._clearAllTimers();
    if (this._isShuttingDown) {
      return;
    }
    this._cooldownTimer = setTimeout(() => {
      this._cooldownTimer = null;
      _StatsigSession.checkForIdleSession(this._sdkKey);
      this._attemptScheduledFlush();
    }, _EventRetryConstants.TICK_INTERVAL_MS);
    const maxIntervalDelay = Math.max(0, this._flushInterval.getTimeTillMaxInterval());
    this._maxIntervalTimer = setTimeout(() => {
      this._maxIntervalTimer = null;
      _StatsigSession.checkForIdleSession(this._sdkKey);
      this._attemptScheduledFlush();
    }, maxIntervalDelay);
  }
  _processNextBatch(flushType) {
    return __awaiter(this, void 0, void 0, function* () {
      this._prepareQueueForFlush(flushType);
      const batch = this._batchQueue.takeNextBatch();
      if (!batch) {
        return false;
      }
      return this._processOneBatch(batch, flushType);
    });
  }
  _processOneBatch(batch, flushType) {
    return __awaiter(this, void 0, void 0, function* () {
      if (this._loggingEnabled !== _LoggingEnabledOption.always && (0, _isServerEnv)()) {
        this._flushInterval.adjustForSuccess();
        return true;
      }
      const result = yield this._eventSender.sendBatch(batch);
      if (result.success) {
        this._flushInterval.adjustForSuccess();
        return true;
      }
      this._flushInterval.adjustForFailure();
      this._handleFailure(batch, flushType, result.statusCode, result.failurePath, result.failureErrorMessage, result.failureDiagnosticBucket, result.failureDiagnosticMetadata);
      return false;
    });
  }
  _prepareQueueForFlush(flushType) {
    this._onPrepareFlush();
    const droppedCount = this.convertPendingEventsToBatches();
    if (droppedCount > 0) {
      _Log.warn(`Dropped ${droppedCount} events`);
      this._errorBoundary.logDroppedEvents(droppedCount, `Batch queue limit reached during batching`, {
        loggingInterval: this._flushInterval.getCurrentIntervalMs(),
        batchSize: this._batchQueue.batchSize(),
        maxPendingBatches: _EventRetryConstants.MAX_PENDING_BATCHES,
        flushType: flushType,
        retries: 'dropped before batching'
      });
    }
  }
  containsAtLeastOneFullBatch() {
    return this._pendingEvents.hasEventsForFullBatch() || this._batchQueue.hasFullBatch();
  }
  convertPendingEventsToBatches() {
    if (this._pendingEvents.isEmpty()) {
      return 0;
    }
    const allEvents = this._pendingEvents.takeAll();
    return this._batchQueue.createBatches(allEvents);
  }
  _isRetryableBatch(statusCode, failurePath) {
    if (_RETRYABLE_CODES.has(statusCode)) {
      return true;
    }
    if (statusCode === -1 && failurePath && RETRYABLE_NO_RESPONSE_FAILURE_PATHS.has(failurePath)) {
      return true;
    }
    return false;
  }
  _handleFailure(batch, flushType, statusCode, failurePath, failureErrorMessage, failureDiagnosticBucket, failureDiagnosticMetadata) {
    if (flushType === _FlushTypeValues.Shutdown) {
      _Log.warn(`${flushType} flush failed during shutdown. ` + `${batch.events.length} event(s) will be saved to storage for retry in next session.`);
      this._saveShutdownFailedEventsToStorage(batch.events);
      return;
    }
    if (!this._isRetryableBatch(statusCode, failurePath)) {
      const reason = `non-retryable error`;
      _Log.warn(`${flushType} flush failed after ${batch.attempts} attempt(s). ` + `${batch.events.length} event(s) will be dropped. Non-retryable error: ${statusCode}`);
      this._errorBoundary.logEventRequestFailure(batch.events.length, reason, flushType, statusCode, batch.attempts, failurePath, failureErrorMessage, failureDiagnosticBucket, failureDiagnosticMetadata);
      return;
    }
    if (batch.attempts >= _EventRetryConstants.MAX_RETRY_ATTEMPTS) {
      const reason = `max retry attempts exceeded`;
      _Log.warn(`${flushType} flush failed after ${batch.attempts} attempt(s). ` + `${batch.events.length} event(s) will be dropped.`);
      this._errorBoundary.logEventRequestFailure(batch.events.length, reason, flushType, statusCode, batch.attempts, failurePath, failureErrorMessage, failureDiagnosticBucket, failureDiagnosticMetadata);
      return;
    }
    batch.incrementAttempts();
    const droppedCount = this._batchQueue.requeueBatch(batch);
    if (droppedCount > 0) {
      _Log.warn(`Failed to requeue batch : dropped ${droppedCount} events due to full queue`);
      this._errorBoundary.logDroppedEvents(droppedCount, `Batch queue limit reached during requeue`, {
        loggingInterval: this._flushInterval.getCurrentIntervalMs(),
        batchSize: this._batchQueue.batchSize(),
        maxPendingBatches: _EventRetryConstants.MAX_PENDING_BATCHES,
        flushType: flushType,
        retries: batch.attempts
      });
    }
  }
  loadAndRetryShutdownFailedEvents() {
    return __awaiter(this, void 0, void 0, function* () {
      const storageKey = this._getStorageKey();
      try {
        if (!_Storage.isReady()) {
          yield _Storage.isReadyResolver();
        }
        const events = this._getShutdownFailedEventsFromStorage(storageKey);
        if (events.length === 0) {
          return;
        }
        _Log.debug(`Loading ${events.length} failed shutdown event(s) from storage for retry`);
        _Storage.removeItem(storageKey);
        events.forEach(event => {
          this.addEvent(event);
        });
        yield this.processManualFlush();
      } catch (error) {
        _Log.warn('Failed to load and retry failed shutdown events:', error);
      }
    });
  }
  _getStorageKey() {
    if (!this._storageKey) {
      this._storageKey = `statsig.failed_shutdown_events.${(0, _DJB)(this._sdkKey)}`;
    }
    return this._storageKey;
  }
  _saveShutdownFailedEventsToStorage(events) {
    const storageKey = this._getStorageKey();
    try {
      const existingEvents = this._getShutdownFailedEventsFromStorage(storageKey);
      let allEvents = [...existingEvents, ...events];
      if (allEvents.length > _EventRetryConstants.MAX_LOCAL_STORAGE) {
        allEvents = allEvents.slice(-_EventRetryConstants.MAX_LOCAL_STORAGE);
      }
      (0, _setObjectInStorage)(storageKey, allEvents);
      _Log.debug(`Saved ${events.length} failed shutdown event(s) to storage (total stored: ${allEvents.length})`);
    } catch (error) {
      _Log.warn('Unable to save failed shutdown events to storage:', error);
    }
  }
  _getShutdownFailedEventsFromStorage(storageKey) {
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
}
const _cjs_default = {
  ["FlushCoordinator"]: FlushCoordinator
};
export default _cjs_default;
