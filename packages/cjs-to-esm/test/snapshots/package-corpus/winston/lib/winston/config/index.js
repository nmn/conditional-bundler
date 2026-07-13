import { levels as _levels } from "logform";
import { configs as _configs } from "triple-beam";
/**
 * Export config set for the CLI.
 * @type {Object}
 */
const _cli = _levels(_configs.cli);
export { _cli as cli };
/**
 * Export config set for npm.
 * @type {Object}
 */
const _npm = _levels(_configs.npm);
export { _npm as npm };
/**
 * Export config set for the syslog.
 * @type {Object}
 */
const _syslog = _levels(_configs.syslog);
export { _syslog as syslog };
/**
 * Hoist addColors from logform where it was refactored into in winston@3.
 * @type {Object}
 */
export { _levels as addColors };
const _cjs_default = {
  ["cli"]: _cli,
  ["npm"]: _npm,
  ["syslog"]: _syslog,
  ["addColors"]: _levels
};
export default _cjs_default;
