const _LogEventCompressionMode = {
  /** Do not compress request bodies */
  Disabled: 'd',
  /** Compress request bodies unless a network proxy is configured */
  Enabled: 'e',
  /** Always compress request bodies, even when a proxy is configured */
  Forced: 'f'
};
export { _LogEventCompressionMode as LogEventCompressionMode };
const _LoggingEnabledOption = {
  disabled: 'disabled',
  browserOnly: 'browser-only',
  always: 'always'
};
export { _LoggingEnabledOption as LoggingEnabledOption };
const _cjs_default = {
  ["LoggingEnabledOption"]: _LoggingEnabledOption,
  ["LogEventCompressionMode"]: _LogEventCompressionMode
};
export default _cjs_default;
