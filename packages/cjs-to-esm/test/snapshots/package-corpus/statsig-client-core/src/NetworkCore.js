import { _getStatsigGlobalFlag } from "./$_StatsigGlobal";
import { Diagnostics as _Diagnostics } from "./Diagnostics";
import { Log as _Log } from "./Log";
import { Endpoint as _Endpoint, NetworkParam as _NetworkParam } from "./NetworkConfig";
import { NetworkFallbackResolver as _NetworkFallbackResolver } from "./NetworkFallbackResolver";
import { SDKFlags as _SDKFlags } from "./SDKFlags";
import { SDKType as _SDKType } from "./SDKType";
import { _getWindowSafe } from "./SafeJs";
import { SessionID as _SessionID } from "./SessionID";
import { StableID as _StableID } from "./StableID";
import { ErrorTag as _ErrorTag } from "./StatsigClientEventEmitter";
import { SDK_VERSION as _SDK_VERSION, StatsigMetadataProvider as _StatsigMetadataProvider } from "./StatsigMetadata";
import { LogEventCompressionMode as _LogEventCompressionMode } from "./StatsigOptionsCommon";
import { _isUnloading } from "./VisibilityObserving";
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
const DEFAULT_TIMEOUT_MS = 10000;
const BACKOFF_BASE_MS = 500;
const BACKOFF_MAX_MS = 30000;
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_REQ_COUNT = 50;
const LEAK_RATE = RATE_LIMIT_MAX_REQ_COUNT / RATE_LIMIT_WINDOW_MS;
const _RETRYABLE_CODES = new Set([408, 500, 502, 503, 504, 522, 524, 599]);
export { _RETRYABLE_CODES as RETRYABLE_CODES };
export class NetworkCore {
  constructor(options, _emitter) {
    this._emitter = _emitter;
    this._errorBoundary = null;
    this._timeout = DEFAULT_TIMEOUT_MS;
    this._netConfig = {};
    this._options = {};
    this._leakyBucket = {};
    this._lastUsedInitUrl = null;
    if (options) {
      this._options = options;
    }
    if (this._options.networkConfig) {
      this._netConfig = this._options.networkConfig;
    }
    if (this._netConfig.networkTimeoutMs) {
      this._timeout = this._netConfig.networkTimeoutMs;
    }
    this._fallbackResolver = new _NetworkFallbackResolver(this._options);
    this.setLogEventCompressionMode(this._getLogEventCompressionMode(options));
  }
  setLogEventCompressionMode(mode) {
    this._options.logEventCompressionMode = mode;
  }
  setErrorBoundary(errorBoundary) {
    this._errorBoundary = errorBoundary;
    this._errorBoundary.wrap(this);
    this._errorBoundary.wrap(this._fallbackResolver);
    this._fallbackResolver.setErrorBoundary(errorBoundary);
  }
  isBeaconSupported() {
    return typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function';
  }
  getLastUsedInitUrlAndReset() {
    const tempUrl = this._lastUsedInitUrl;
    this._lastUsedInitUrl = null;
    return tempUrl;
  }
  beacon(args, failureInfo) {
    if (!_ensureValidSdkKey(args)) {
      if (failureInfo) {
        failureInfo.path = 'beacon_invalid_sdk_key';
      }
      return false;
    }
    const argsInternal = this._getInternalRequestArgs('POST', args);
    const url = this._getPopulatedURL(argsInternal);
    const nav = navigator;
    try {
      const success = nav.sendBeacon.bind(nav)(url, argsInternal.body);
      if (!success) {
        if (failureInfo) {
          failureInfo.path = 'beacon_send_false';
        }
      }
      return success;
    } catch (error) {
      if (failureInfo) {
        failureInfo.path = 'beacon_send_exception';
      }
      throw error;
    }
  }
  post(args, failureInfo) {
    return __awaiter(this, void 0, void 0, function* () {
      const argsInternal = this._getInternalRequestArgs('POST', args);
      this._tryEncodeBody(argsInternal);
      yield this._tryToCompressBody(argsInternal);
      return this._sendRequest(argsInternal, failureInfo);
    });
  }
  get(args) {
    const argsInternal = this._getInternalRequestArgs('GET', args);
    return this._sendRequest(argsInternal);
  }
  _sendRequest(args, failureInfo) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, _b, _c, _d;
      if (!_ensureValidSdkKey(args)) {
        if (failureInfo) {
          failureInfo.path = 'network_invalid_sdk_key';
        }
        return null;
      }
      if (this._netConfig.preventAllNetworkTraffic) {
        if (failureInfo) {
          failureInfo.path = 'network_prevent_all_network_traffic';
        }
        return null;
      }
      const {
        method,
        body,
        retries,
        attempt
      } = args;
      const endpoint = args.urlConfig.endpoint;
      if (this._isRateLimited(endpoint)) {
        _Log.warn(`Request to ${endpoint} was blocked because you are making requests too frequently.`);
        if (failureInfo) {
          failureInfo.path = 'network_rate_limited';
        }
        return null;
      }
      const currentAttempt = attempt !== null && attempt !== void 0 ? attempt : 1;
      let reqTimedOut = false;
      const populatedUrl = this._getPopulatedURL(args);
      const startTime = Date.now();
      let response = null;
      const keepalive = (0, _isUnloading)();
      try {
        const config = {
          method,
          body,
          headers: Object.assign({}, args.headers),
          priority: args.priority,
          keepalive
        };
        _tryMarkInitStart(args, currentAttempt);
        const bucket = this._leakyBucket[endpoint];
        if (bucket) {
          bucket.lastRequestTime = Date.now();
          this._leakyBucket[endpoint] = bucket;
        }
        const func = (_a = this._netConfig.networkOverrideFunc) !== null && _a !== void 0 ? _a : fetch;
        let timeoutId;
        response = yield Promise.race([func(populatedUrl, config).finally(() => clearTimeout(timeoutId)), new Promise((_, reject) => {
          timeoutId = setTimeout(() => {
            reqTimedOut = true;
            reject(new Error(`Timeout of ${this._timeout}ms expired.`));
          }, this._timeout);
        })]);
        if (!response.ok) {
          const text = yield response.text().catch(() => 'No Text');
          const err = new Error(`NetworkError: ${populatedUrl} ${text}`);
          err.name = 'NetworkError';
          throw err;
        }
        const text = yield response.text();
        _tryMarkInitEnd(args, response, currentAttempt, text);
        this._fallbackResolver.tryBumpExpiryTime(args.sdkKey, args.urlConfig);
        return {
          body: text,
          code: response.status
        };
      } catch (error) {
        const errorMessage = _getErrorMessage(error);
        const timedOut = _didTimeout(errorMessage !== null && errorMessage !== void 0 ? errorMessage : '', reqTimedOut);
        _tryMarkInitEnd(args, response, currentAttempt, '', error);
        const fallbackUpdated = yield this._fallbackResolver.tryFetchUpdatedFallbackInfo(args.sdkKey, args.urlConfig, errorMessage, timedOut);
        if (fallbackUpdated) {
          args.fallbackUrl = this._fallbackResolver.getActiveFallbackUrl(args.sdkKey, args.urlConfig);
        }
        if (!retries || currentAttempt > retries || !_RETRYABLE_CODES.has((_b = response === null || response === void 0 ? void 0 : response.status) !== null && _b !== void 0 ? _b : 500)) {
          (_c = this._emitter) === null || _c === void 0 ? void 0 : _c.call(this, {
            name: 'error',
            error,
            tag: _ErrorTag.NetworkError,
            requestArgs: args
          });
          const formattedErrorMsg = `A networking error occurred during ${method} request to ${populatedUrl}.`;
          _Log.error(formattedErrorMsg, errorMessage, error);
          (_d = this._errorBoundary) === null || _d === void 0 ? void 0 : _d.attachErrorIfNoneExists(formattedErrorMsg);
          if (args.preserveFailedStatusCode && response != null) {
            return {
              body: null,
              code: response.status
            };
          }
          if (response == null) {
            if (failureInfo) {
              failureInfo.path = timedOut ? 'network_request_timed_out_no_response' : 'network_request_exception_no_response';
              if (errorMessage) {
                failureInfo.errorMessage = errorMessage;
              }
              try {
                const diagnostics = _getNoResponseDiagnostics(args, populatedUrl, timedOut, Date.now() - startTime);
                failureInfo.diagnosticBucket = diagnostics.bucket;
                failureInfo.diagnosticMetadata = diagnostics.metadata;
              } catch (_e) {
                // Diagnostics should not affect request failure handling.
              }
            }
          }
          return null;
        }
        yield _exponentialBackoff(currentAttempt);
        return this._sendRequest(Object.assign(Object.assign({}, args), {
          retries,
          attempt: currentAttempt + 1
        }), failureInfo);
      }
    });
  }
  _getLogEventCompressionMode(options) {
    // Handle backward compatibility for deprecated disableCompression flag
    let compressionMode = options === null || options === void 0 ? void 0 : options.logEventCompressionMode;
    if (!compressionMode && (options === null || options === void 0 ? void 0 : options.disableCompression) === true) {
      compressionMode = _LogEventCompressionMode.Disabled;
    }
    // Default to enabled if unset
    if (!compressionMode) {
      compressionMode = _LogEventCompressionMode.Enabled;
    }
    return compressionMode;
  }
  _isRateLimited(endpoint) {
    var _a;
    const now = Date.now();
    const bucket = (_a = this._leakyBucket[endpoint]) !== null && _a !== void 0 ? _a : {
      count: 0,
      lastRequestTime: now
    };
    const elapsed = now - bucket.lastRequestTime;
    const leakedRequests = Math.floor(elapsed * LEAK_RATE);
    bucket.count = Math.max(0, bucket.count - leakedRequests);
    if (bucket.count >= RATE_LIMIT_MAX_REQ_COUNT) {
      return true;
    }
    bucket.count += 1;
    bucket.lastRequestTime = now;
    this._leakyBucket[endpoint] = bucket;
    return false;
  }
  _getPopulatedURL(args) {
    var _a;
    const url = (_a = args.fallbackUrl) !== null && _a !== void 0 ? _a : args.urlConfig.getUrl();
    if (args.urlConfig.endpoint === _Endpoint._initialize || args.urlConfig.endpoint === _Endpoint._download_config_specs) {
      this._lastUsedInitUrl = url;
    }
    const params = Object.assign({
      [_NetworkParam.SdkKey]: args.sdkKey,
      [_NetworkParam.SdkType]: _SDKType._get(args.sdkKey),
      [_NetworkParam.SdkVersion]: _SDK_VERSION,
      [_NetworkParam.Time]: String(Date.now()),
      [_NetworkParam.SessionID]: _SessionID.get(args.sdkKey)
    }, args.params);
    const query = Object.keys(params).map(key => {
      return `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`;
    }).join('&');
    return `${url}${query ? `?${query}` : ''}`;
  }
  _tryEncodeBody(args) {
    var _a;
    const win = (0, _getWindowSafe)();
    const body = args.body;
    if (!args.isStatsigEncodable || this._options.disableStatsigEncoding || typeof body !== 'string' || (0, _getStatsigGlobalFlag)('no-encode') != null || !(win === null || win === void 0 ? void 0 : win.btoa)) {
      return;
    }
    try {
      args.body = win.btoa(body).split('').reverse().join('');
      args.params = Object.assign(Object.assign({}, (_a = args.params) !== null && _a !== void 0 ? _a : {}), {
        [_NetworkParam.StatsigEncoded]: '1'
      });
    } catch (e) {
      _Log.warn(`Request encoding failed for ${args.urlConfig.getUrl()}`, e);
    }
  }
  _tryToCompressBody(args) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a;
      const body = args.body;
      if (typeof body !== 'string' || !_allowCompression(args, this._options)) {
        return;
      }
      try {
        const bytes = new TextEncoder().encode(body);
        const stream = new CompressionStream('gzip');
        const writer = stream.writable.getWriter();
        writer.write(bytes).catch(_Log.error);
        writer.close().catch(_Log.error);
        const reader = stream.readable.getReader();
        const chunks = [];
        let result;
        // eslint-disable-next-line no-await-in-loop
        while (!(result = yield reader.read()).done) {
          chunks.push(result.value);
        }
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }
        args.body = combined;
        args.params = Object.assign(Object.assign({}, (_a = args.params) !== null && _a !== void 0 ? _a : {}), {
          [_NetworkParam.IsGzipped]: '1'
        });
      } catch (e) {
        _Log.warn(`Request compression failed for ${args.urlConfig.getUrl()}`, e);
      }
    });
  }
  _getInternalRequestArgs(method, args) {
    const fallbackUrl = this._fallbackResolver.getActiveFallbackUrl(args.sdkKey, args.urlConfig);
    const result = Object.assign(Object.assign({}, args), {
      method,
      fallbackUrl
    });
    if ('data' in args) {
      _populateRequestBody(result, args.data);
    }
    return result;
  }
}
const _ensureValidSdkKey = args => {
  if (!args.sdkKey) {
    _Log.warn('Unable to make request without an SDK key');
    return false;
  }
  return true;
};
const _populateRequestBody = (args, data) => {
  const {
    sdkKey,
    fallbackUrl
  } = args;
  const stableID = _StableID.get(sdkKey);
  const sessionID = _SessionID.get(sdkKey);
  const sdkType = _SDKType._get(sdkKey);
  args.body = JSON.stringify(Object.assign(Object.assign({}, data), {
    statsigMetadata: Object.assign(Object.assign({}, _StatsigMetadataProvider.get()), {
      stableID,
      sessionID,
      sdkType,
      fallbackUrl
    })
  }));
};
function _allowCompression(args, options) {
  if (!args.isCompressable) {
    return false;
  }
  // Never compress if 'no-compress' is set globally or required APIs are unavailable
  if ((0, _getStatsigGlobalFlag)('no-compress') != null || typeof CompressionStream === 'undefined' || typeof TextEncoder === 'undefined') {
    return false;
  }
  const isProxy = args.urlConfig.customUrl != null || args.urlConfig.fallbackUrls != null;
  const flagEnabled = _SDKFlags.get(args.sdkKey, 'enable_log_event_compression') === true;
  switch (options.logEventCompressionMode) {
    case _LogEventCompressionMode.Disabled:
      return false;
    case _LogEventCompressionMode.Enabled:
      // Only compress through proxy if flag is explicitly on
      if (isProxy && !flagEnabled) {
        return false;
      }
      return true;
    case _LogEventCompressionMode.Forced:
      return true;
    default:
      return false;
  }
}
function _getErrorMessage(error) {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return 'Unknown Error';
}
function _didTimeout(errorMsg, abortedByTimeout) {
  const timeout = errorMsg.includes('Timeout'); // probably not needed but just in case
  return timeout || abortedByTimeout;
}
function _getNoResponseDiagnostics(args, populatedUrl, timedOut, elapsedMs) {
  var _a, _b, _c;
  const win = (0, _getWindowSafe)();
  const doc = win === null || win === void 0 ? void 0 : win.document;
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const isUnloading = (0, _isUnloading)();
  const online = nav && typeof nav.onLine === 'boolean' ? String(nav.onLine) : 'unknown';
  const visibilityState = (_a = doc === null || doc === void 0 ? void 0 : doc.visibilityState) !== null && _a !== void 0 ? _a : 'unknown';
  const hasCustomHeaders = Object.keys((_b = args.headers) !== null && _b !== void 0 ? _b : {}).length > 0;
  const crossOrigin = _isCrossOrigin(populatedUrl, (_c = win === null || win === void 0 ? void 0 : win.location) === null || _c === void 0 ? void 0 : _c.origin);
  const hasCustomUrl = args.urlConfig.customUrl != null;
  const hasFallbackUrl = args.fallbackUrl != null;
  const elapsedMsBucket = _bucketNumber(elapsedMs, [250, 1000, 5000, 10000]);
  const bodySizeBucket = _bucketNumber(_getBodySize(args.body), [16384, 65536, 262144, 1048576]);
  let bucket = 'unknown_no_response';
  if (timedOut) {
    bucket = 'timeout';
  } else if (online === 'false') {
    bucket = 'browser_offline';
  } else if (isUnloading) {
    bucket = 'page_unloading';
  } else if (visibilityState === 'hidden') {
    bucket = 'page_hidden';
  } else if (crossOrigin && hasCustomHeaders) {
    bucket = 'cross_origin_custom_headers_preflight_risk';
  } else if (hasCustomUrl || hasFallbackUrl) {
    bucket = 'custom_url_no_response';
  } else if (elapsedMs < 250) {
    bucket = 'immediate_network_rejection';
  }
  return {
    bucket,
    metadata: {
      elapsedMsBucket,
      bodySizeBucket,
      online,
      visibilityState,
      isUnloading: String(isUnloading),
      crossOrigin: String(crossOrigin),
      hasCustomUrl: String(hasCustomUrl)
    }
  };
}
function _isCrossOrigin(url, currentOrigin) {
  if (!currentOrigin) {
    return true;
  }
  return !url.startsWith(`${currentOrigin}/`) && !url.startsWith(`${currentOrigin}?`) && url !== currentOrigin;
}
function _getBodySize(body) {
  if (body == null) {
    return 0;
  }
  if (typeof body === 'string') {
    return body.length;
  }
  if (body instanceof Uint8Array) {
    return body.byteLength;
  }
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return body.size;
  }
  return -1;
}
function _bucketNumber(value, thresholds) {
  if (value < 0) {
    return 'unknown';
  }
  for (const threshold of thresholds) {
    if (value < threshold) {
      return `<${threshold}`;
    }
  }
  return `>=${thresholds[thresholds.length - 1]}`;
}
function _tryMarkInitStart(args, attempt) {
  if (args.urlConfig.endpoint !== _Endpoint._initialize) {
    return;
  }
  _Diagnostics._markInitNetworkReqStart(args.sdkKey, {
    attempt
  });
}
function _tryMarkInitEnd(args, response, attempt, body, err) {
  if (args.urlConfig.endpoint !== _Endpoint._initialize) {
    return;
  }
  _Diagnostics._markInitNetworkReqEnd(args.sdkKey, _Diagnostics._getDiagnosticsData(response, attempt, body, err));
}
function _exponentialBackoff(attempt) {
  return __awaiter(this, void 0, void 0, function* () {
    // 1*1*1000 1s
    // 2*2*1000 4s
    // 3*3*1000 9s
    // 4*4*1000 16s
    // 5*5*1000 25s
    yield new Promise(r => setTimeout(r, Math.min(BACKOFF_BASE_MS * (attempt * attempt), BACKOFF_MAX_MS)));
  });
}
const _cjs_default = {
  ["NetworkCore"]: NetworkCore,
  ["RETRYABLE_CODES"]: _RETRYABLE_CODES
};
export default _cjs_default;
