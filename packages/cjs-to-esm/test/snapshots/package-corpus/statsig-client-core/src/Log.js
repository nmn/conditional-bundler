/* eslint-disable no-console */

// intentionally spaced for formatting
const DEBUG = ' DEBUG ';
const _INFO = '  INFO ';
const _WARN = '  WARN ';
const ERROR = ' ERROR ';
function addTag(args) {
  args.unshift('[Statsig]');
  return args; // ['[Statsig]', ...args];
}
const _LogLevel = {
  None: 0,
  Error: 1,
  Warn: 2,
  Info: 3,
  Debug: 4
};
export { _LogLevel as LogLevel };
export class Log {
  static info(...args) {
    if (Log.level >= _LogLevel.Info) {
      console.info(_INFO, ...addTag(args));
    }
  }
  static debug(...args) {
    if (Log.level >= _LogLevel.Debug) {
      console.debug(DEBUG, ...addTag(args));
    }
  }
  static warn(...args) {
    if (Log.level >= _LogLevel.Warn) {
      console.warn(_WARN, ...addTag(args));
    }
  }
  static error(...args) {
    if (Log.level >= _LogLevel.Error) {
      console.error(ERROR, ...addTag(args));
    }
  }
}
Log.level = _LogLevel.Warn;
const _cjs_default = {
  ["Log"]: Log,
  ["LogLevel"]: _LogLevel
};
export default _cjs_default;
