import { _DJB2 as _DJB } from "@statsig/client-core";
export class V1InitializeContainer {
  constructor(_values) {
    this._values = _values;
  }
  getGate(name) {
    return this._getResultFromLookup(this._values.feature_gates, name);
  }
  getConfig(name) {
    return this._getResultFromLookup(this._values.dynamic_configs, name);
  }
  getLayer(name) {
    return this._getResultFromLookup(this._values.layer_configs, name);
  }
  getParamStore(name) {
    return this._getResultFromLookup(this._values.param_stores, name);
  }
  getConfigList() {
    return Object.keys(this._values.dynamic_configs);
  }
  getExposureMapping() {
    return this._values.exposures;
  }
  _getResultFromLookup(lookup, name) {
    var _a, _b;
    if (!lookup) {
      return null;
    }
    return (_b = (_a = lookup[name]) !== null && _a !== void 0 ? _a : lookup[(0, _DJB)(name)]) !== null && _b !== void 0 ? _b : null;
  }
}
const _cjs_default = {
  ["V1InitializeContainer"]: V1InitializeContainer
};
export default _cjs_default;
