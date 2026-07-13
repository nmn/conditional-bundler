import { NetworkCore as _NetworkCore, UrlConfiguration as _UrlConfiguration, Endpoint as _Endpoint, _typedJsonParse } from "@statsig/client-core";
import { _resolveDeltasResponse } from "./EvaluationResponseDeltas";
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
class StatsigNetwork extends _NetworkCore {
  constructor(options, emitter) {
    super(options, emitter);
    const config = options === null || options === void 0 ? void 0 : options.networkConfig;
    this._option = options;
    this._initializeUrlConfig = new _UrlConfiguration(_Endpoint._initialize, config === null || config === void 0 ? void 0 : config.initializeUrl, config === null || config === void 0 ? void 0 : config.api, config === null || config === void 0 ? void 0 : config.initializeFallbackUrls);
  }
  fetchEvaluations(sdkKey, current, priority, user, isCacheValidFor204) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, _b, _c, _d, _e, _f;
      const cache = current ? (0, _typedJsonParse)(current, 'has_updates', 'InitializeResponse') : null;
      let data = {
        user,
        hash: (_c = (_b = (_a = this._option) === null || _a === void 0 ? void 0 : _a.networkConfig) === null || _b === void 0 ? void 0 : _b.initializeHashAlgorithm) !== null && _c !== void 0 ? _c : 'djb2',
        deltasResponseRequested: false,
        full_checksum: null
      };
      if (cache === null || cache === void 0 ? void 0 : cache.has_updates) {
        const hasHashChanged = (cache === null || cache === void 0 ? void 0 : cache.hash_used) !== ((_f = (_e = (_d = this._option) === null || _d === void 0 ? void 0 : _d.networkConfig) === null || _e === void 0 ? void 0 : _e.initializeHashAlgorithm) !== null && _f !== void 0 ? _f : 'djb2');
        data = Object.assign(Object.assign({}, data), {
          sinceTime: isCacheValidFor204 && !hasHashChanged ? cache.time : 0,
          previousDerivedFields: 'derived_fields' in cache && isCacheValidFor204 ? cache.derived_fields : {},
          deltasResponseRequested: true,
          full_checksum: cache.full_checksum,
          partialUserMatchSinceTime: !hasHashChanged ? cache.time : 0
        });
      }
      return this._fetchEvaluations(sdkKey, cache, data, priority);
    });
  }
  _fetchEvaluations(sdkKey, cache, data, priority) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, _b;
      const response = yield this.post({
        sdkKey,
        urlConfig: this._initializeUrlConfig,
        data,
        retries: 2,
        isStatsigEncodable: true,
        priority
      });
      if ((response === null || response === void 0 ? void 0 : response.code) === 204) {
        return '{"has_updates": false}';
      }
      if ((response === null || response === void 0 ? void 0 : response.code) !== 200) {
        return (_a = response === null || response === void 0 ? void 0 : response.body) !== null && _a !== void 0 ? _a : null;
      }
      if ((cache === null || cache === void 0 ? void 0 : cache.has_updates) !== true || ((_b = response.body) === null || _b === void 0 ? void 0 : _b.includes('"is_delta":true')) !== true || data.deltasResponseRequested !== true) {
        return response.body;
      }
      const result = (0, _resolveDeltasResponse)(cache, response.body);
      if (typeof result === 'string') {
        return result;
      }
      // retry without deltas
      return this._fetchEvaluations(sdkKey, cache, Object.assign(Object.assign(Object.assign({}, data), result), {
        deltasResponseRequested: false
      }), priority);
    });
  }
}
const _cjs_default = {
  ["default"]: StatsigNetwork
};
export default _cjs_default;
