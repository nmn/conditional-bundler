const SDK_CLIENT = {};
let suffix;
const _SDKType = {
  _get: sdkKey => {
    var _a;
    return ((_a = SDK_CLIENT[sdkKey]) !== null && _a !== void 0 ? _a : 'js-mono') + (suffix !== null && suffix !== void 0 ? suffix : '');
  },
  _setClientType(sdkKey, client) {
    SDK_CLIENT[sdkKey] = client;
  },
  _setBindingType(binding) {
    if (!suffix || suffix === '-react') {
      suffix = '-' + binding;
    }
  }
};
export { _SDKType as SDKType };
const _cjs_default = {
  ["SDKType"]: _SDKType
};
export default _cjs_default;
