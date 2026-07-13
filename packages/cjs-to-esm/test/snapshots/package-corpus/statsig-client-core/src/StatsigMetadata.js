const _SDK_VERSION = '3.33.3';
export { _SDK_VERSION as SDK_VERSION };
let metadata = {
  sdkVersion: _SDK_VERSION,
  sdkType: 'js-mono' // js-mono is overwritten by Precomp and OnDevice clients
};
const _StatsigMetadataProvider = {
  get: () => metadata,
  add: additions => {
    metadata = Object.assign(Object.assign({}, metadata), additions);
  }
};
export { _StatsigMetadataProvider as StatsigMetadataProvider };
const _cjs_default = {
  ["StatsigMetadataProvider"]: _StatsigMetadataProvider,
  ["SDK_VERSION"]: _SDK_VERSION
};
export default _cjs_default;
