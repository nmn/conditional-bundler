import { _DJB2 as _DJB } from "./Hashing";
import { Endpoint as _Endpoint, NetworkDefault as _NetworkDefault } from "./NetworkConfig";
const ENDPOINT_DNS_KEY_MAP = {
  [_Endpoint._initialize]: 'i',
  [_Endpoint._rgstr]: 'e',
  [_Endpoint._download_config_specs]: 'd'
};
export class UrlConfiguration {
  constructor(endpoint, customUrl, customApi, fallbackUrls) {
    this.customUrl = null;
    this.fallbackUrls = null;
    this.endpoint = endpoint;
    this.endpointDnsKey = ENDPOINT_DNS_KEY_MAP[endpoint];
    if (customUrl) {
      this.customUrl = customUrl;
    }
    if (!customUrl && customApi) {
      this.customUrl = customApi.endsWith('/') ? `${customApi}${endpoint}` : `${customApi}/${endpoint}`;
    }
    if (fallbackUrls) {
      this.fallbackUrls = fallbackUrls;
    }
    const defaultApi = _NetworkDefault[endpoint];
    this.defaultUrl = `${defaultApi}/${endpoint}`;
  }
  getUrl() {
    var _a;
    return (_a = this.customUrl) !== null && _a !== void 0 ? _a : this.defaultUrl;
  }
  getChecksum() {
    var _a;
    const fallbacks = ((_a = this.fallbackUrls) !== null && _a !== void 0 ? _a : []).sort().join(',');
    return (0, _DJB)(this.customUrl + fallbacks);
  }
}
const _cjs_default = {
  ["UrlConfiguration"]: UrlConfiguration
};
export default _cjs_default;
