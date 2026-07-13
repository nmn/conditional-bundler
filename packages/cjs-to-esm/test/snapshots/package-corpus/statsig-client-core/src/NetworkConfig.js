const _Endpoint = {
  _initialize: 'initialize',
  _rgstr: 'rgstr',
  _download_config_specs: 'download_config_specs'
};
export { _Endpoint as Endpoint };
const _NetworkDefault = {
  [_Endpoint._rgstr]: 'https://prodregistryv2.org/v1',
  [_Endpoint._initialize]: 'https://featureassets.org/v1',
  [_Endpoint._download_config_specs]: 'https://api.statsigcdn.com/v1'
};
export { _NetworkDefault as NetworkDefault };
const _NetworkParam = {
  EventCount: 'ec',
  SdkKey: 'k',
  SdkType: 'st',
  SdkVersion: 'sv',
  Time: 't',
  SessionID: 'sid',
  StatsigEncoded: 'se',
  IsGzipped: 'gz'
};
export { _NetworkParam as NetworkParam };
const _cjs_default = {
  ["NetworkParam"]: _NetworkParam,
  ["NetworkDefault"]: _NetworkDefault,
  ["Endpoint"]: _Endpoint
};
export default _cjs_default;
