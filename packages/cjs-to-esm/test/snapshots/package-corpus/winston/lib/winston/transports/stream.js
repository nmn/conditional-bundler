import isStream from "is-stream";
import _cjs_import from "triple-beam";
import * as os from "node:os";
import TransportStream from "winston-transport";
const {
  MESSAGE
} = _cjs_import;
/**
 * Transport for outputting to any arbitrary stream.
 * @type {Stream}
 * @extends {TransportStream}
 */
const _cjs_default = class Stream extends TransportStream {
  /**
   * Constructor function for the Console transport object responsible for
   * persisting log messages and metadata to a terminal or TTY.
   * @param {!Object} [options={}] - Options for this instance.
   */
  constructor(options = {}) {
    super(options);
    if (!options.stream || !isStream(options.stream)) {
      throw new Error('options.stream is required.');
    }

    // We need to listen for drain events when write() returns false. This can
    // make node mad at times.
    this._stream = options.stream;
    this._stream.setMaxListeners(Infinity);
    this.isObjectMode = options.stream._writableState.objectMode;
    this.eol = typeof options.eol === 'string' ? options.eol : os.EOL;
  }

  /**
   * Core logging method exposed to Winston.
   * @param {Object} info - TODO: add param description.
   * @param {Function} callback - TODO: add param description.
   * @returns {undefined}
   */
  log(info, callback) {
    setImmediate(() => this.emit('logged', info));
    if (this.isObjectMode) {
      this._stream.write(info);
      if (callback) {
        callback(); // eslint-disable-line callback-return
      }
      return;
    }
    this._stream.write(`${info[MESSAGE]}${this.eol}`);
    if (callback) {
      callback(); // eslint-disable-line callback-return
    }
    return;
  }
};
export default _cjs_default;
