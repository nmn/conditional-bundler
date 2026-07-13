import { _typedJsonParse, SDKFlags as _SDKFlags, StableID as _StableID, _getFullUserHash } from "@statsig/client-core";
import { V1InitializeContainer as _V1InitializeContainer } from "./V1InitializeContainer";
import { V2InitializeContainer as _V2InitializeContainer } from "./V2InitializeContainer";
class EvaluationStore {
  constructor(_sdkKey, _options) {
    this._sdkKey = _sdkKey;
    this._options = _options;
    this._valuesForExternalUse = null;
    this._values = null;
    this._source = 'Uninitialized';
    this._lcut = 0;
    this._receivedAt = 0;
    this._bootstrapMetadata = null;
    this._warnings = new Set();
  }
  reset() {
    this._values = null;
    this._valuesForExternalUse = null;
    this._source = 'Loading';
    this._lcut = 0;
    this._receivedAt = 0;
    this._bootstrapMetadata = null;
    this._warnings.clear();
  }
  finalize() {
    if (this._values) {
      return;
    }
    this._source = 'NoValues';
  }
  getValues() {
    // we do not give out the actual _values object to avoid mutating it
    return this._valuesForExternalUse;
  }
  setValues(result, user) {
    var _a, _b;
    if (!result) {
      return false;
    }
    const values = (0, _typedJsonParse)(result.data, 'has_updates', 'EvaluationResponse');
    if (values == null) {
      return false;
    }
    this._source = result.source;
    if ((values === null || values === void 0 ? void 0 : values.has_updates) !== true) {
      return true;
    }
    const updatedLcut = (_a = values.time) !== null && _a !== void 0 ? _a : 0;
    if (updatedLcut < this._lcut) {
      return true;
    }
    this._valuesForExternalUse = (0, _typedJsonParse)(result.data, 'has_updates', 'EvaluationResponse');
    this._lcut = values.time;
    this._receivedAt = result.receivedAt;
    if (values.response_format === 'init-v2') {
      this._values = new _V2InitializeContainer(values);
    } else {
      this._values = new _V1InitializeContainer(values);
    }
    this._bootstrapMetadata = this._extractBootstrapMetadata(result.source, values);
    if (result.source && values.user) {
      this._setWarningState(user, values);
    }
    _SDKFlags.setFlags(this._sdkKey, (_b = values.sdk_flags) !== null && _b !== void 0 ? _b : {});
    return true;
  }
  getWarnings() {
    if (this._warnings.size === 0) {
      return undefined;
    }
    return Array.from(this._warnings);
  }
  getGate(name) {
    const res = this._values ? this._values.getGate(name) : null;
    return this._getDetailedStoreResult(res);
  }
  getConfig(name) {
    const res = this._values ? this._values.getConfig(name) : null;
    return this._getDetailedStoreResult(res);
  }
  getConfigList() {
    if (!this._values) {
      return [];
    }
    return this._values.getConfigList();
  }
  getLayer(name) {
    const res = this._values ? this._values.getLayer(name) : null;
    return this._getDetailedStoreResult(res);
  }
  getParamStore(name) {
    const res = this._values ? this._values.getParamStore(name) : null;
    return this._getDetailedStoreResult(res);
  }
  getSource() {
    return this._source;
  }
  getExposureMapping() {
    var _a;
    return (_a = this._values) === null || _a === void 0 ? void 0 : _a.getExposureMapping();
  }
  _extractBootstrapMetadata(source, values) {
    if (source !== 'Bootstrap') {
      return null;
    }
    const bootstrapMetadata = {};
    if (values.user) {
      bootstrapMetadata.user = values.user;
    }
    if (values.sdkInfo) {
      bootstrapMetadata.generatorSDKInfo = values.sdkInfo;
    }
    bootstrapMetadata.lcut = values.time;
    return bootstrapMetadata;
  }
  _getDetailedStoreResult(result) {
    return {
      result,
      details: this._getDetails(result == null)
    };
  }
  _setWarningState(user, values) {
    var _a, _b, _c;
    const stableID = _StableID.get(this._sdkKey);
    if (((_a = user.customIDs) === null || _a === void 0 ? void 0 : _a.stableID) !== stableID && (
    // don't throw if they're both undefined
    ((_b = user.customIDs) === null || _b === void 0 ? void 0 : _b.stableID) || stableID)) {
      this._warnings.add('StableIDMismatch');
      return;
    }
    if ('user' in values) {
      let bootstrapUser = values['user'];
      let userForComparison = Object.assign(Object.assign({}, user), {
        analyticsOnlyMetadata: undefined,
        privateAttributes: undefined
      });
      if ((_c = this._options) === null || _c === void 0 ? void 0 : _c.disableStableID) {
        userForComparison = Object.assign(Object.assign({}, userForComparison), {
          customIDs: Object.assign(Object.assign({}, userForComparison.customIDs), {
            stableID: undefined
          })
        });
        bootstrapUser = Object.assign(Object.assign({}, bootstrapUser), {
          customIDs: Object.assign(Object.assign({}, bootstrapUser.customIDs), {
            stableID: undefined
          })
        });
      }
      if ((0, _getFullUserHash)(userForComparison) !== (0, _getFullUserHash)(bootstrapUser)) {
        this._warnings.add('PartialUserMatch');
      }
    }
  }
  getCurrentSourceDetails() {
    if (this._source === 'Uninitialized' || this._source === 'NoValues') {
      return {
        reason: this._source
      };
    }
    const sourceDetails = {
      reason: this._source,
      lcut: this._lcut,
      receivedAt: this._receivedAt
    };
    if (this._warnings.size > 0) {
      sourceDetails.warnings = Array.from(this._warnings);
    }
    return sourceDetails;
  }
  _getDetails(isUnrecognized) {
    var _a, _b;
    const sourceDetails = this.getCurrentSourceDetails();
    let reason = sourceDetails.reason;
    const warnings = (_a = sourceDetails.warnings) !== null && _a !== void 0 ? _a : [];
    if (this._source === 'Bootstrap' && warnings.length > 0) {
      reason = reason + warnings[0];
    }
    if (reason !== 'Uninitialized' && reason !== 'NoValues') {
      const subreason = isUnrecognized ? 'Unrecognized' : 'Recognized';
      reason = `${reason}:${subreason}`;
    }
    const bootstrapMetadata = this._source === 'Bootstrap' ? (_b = this._bootstrapMetadata) !== null && _b !== void 0 ? _b : undefined : undefined;
    if (bootstrapMetadata) {
      sourceDetails.bootstrapMetadata = bootstrapMetadata;
    }
    return Object.assign(Object.assign({}, sourceDetails), {
      reason
    });
  }
}
const _cjs_default = {
  ["default"]: EvaluationStore
};
export default _cjs_default;
