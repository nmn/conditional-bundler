import logform from "logform";
import _cjs_import from "triple-beam";
const {
  configs
} = _cjs_import;

/**
 * Export config set for the CLI.
 * @type {Object}
 */
const _cli = logform.levels(configs.cli);
export { _cli as cli };
/**
 * Export config set for npm.
 * @type {Object}
 */
const _npm = logform.levels(configs.npm);
export { _npm as npm };
/**
 * Export config set for the syslog.
 * @type {Object}
 */
const _syslog = logform.levels(configs.syslog);
export { _syslog as syslog };
/**
 * Hoist addColors from logform where it was refactored into in winston@3.
 * @type {Object}
 */
const _addColors = logform.levels;
export { _addColors as addColors };
const _cjs_default = {
  ["cli"]: _cli,
  ["npm"]: _npm,
  ["syslog"]: _syslog,
  ["addColors"]: _addColors
};
export default _cjs_default;
