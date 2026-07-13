import Dispatcher from "./dispatcher";
import { ClientDestroyedError as _ClientDestroyedError, ClientClosedError as _ClientClosedError, InvalidArgumentError as _InvalidArgumentError } from "../core/errors";
import { kDestroy as _kDestroy, kClose as _kClose, kClosed as _kClosed, kDestroyed as _kDestroyed, kDispatch as _kDispatch } from "../core/symbols";
const kOnDestroyed = Symbol('onDestroyed');
const kOnClosed = Symbol('onClosed');
const kWebSocketOptions = Symbol('webSocketOptions');
class DispatcherBase extends Dispatcher {
  /** @type {boolean} */
  [_kDestroyed] = false;

  /** @type {Array<Function|null} */
  [kOnDestroyed] = null;

  /** @type {boolean} */
  [_kClosed] = false;

  /** @type {Array<Function>|null} */
  [kOnClosed] = null;

  /**
   * @param {import('../../types/dispatcher').DispatcherOptions} [opts]
   */
  constructor(opts) {
    super();
    this[kWebSocketOptions] = opts?.webSocket ?? {};
  }

  /**
   * @returns {import('../../types/dispatcher').WebSocketOptions}
   */
  get webSocketOptions() {
    return {
      maxFragments: this[kWebSocketOptions].maxFragments ?? 131072,
      maxPayloadSize: this[kWebSocketOptions].maxPayloadSize ?? 128 * 1024 * 1024 // 128 MB default
    };
  }

  /** @returns {boolean} */
  get destroyed() {
    return this[_kDestroyed];
  }

  /** @returns {boolean} */
  get closed() {
    return this[_kClosed];
  }
  close(callback) {
    if (callback === undefined) {
      return new Promise((resolve, reject) => {
        this.close((err, data) => {
          return err ? reject(err) : resolve(data);
        });
      });
    }
    if (typeof callback !== 'function') {
      throw new _InvalidArgumentError('invalid callback');
    }
    if (this[_kDestroyed]) {
      const err = new _ClientDestroyedError();
      queueMicrotask(() => callback(err, null));
      return;
    }
    if (this[_kClosed]) {
      if (this[kOnClosed]) {
        this[kOnClosed].push(callback);
      } else {
        queueMicrotask(() => callback(null, null));
      }
      return;
    }
    this[_kClosed] = true;
    this[kOnClosed] ??= [];
    this[kOnClosed].push(callback);
    const onClosed = () => {
      const callbacks = this[kOnClosed];
      this[kOnClosed] = null;
      for (let i = 0; i < callbacks.length; i++) {
        callbacks[i](null, null);
      }
    };

    // Should not error.
    this[_kClose]().then(() => this.destroy()).then(() => queueMicrotask(onClosed));
  }
  destroy(err, callback) {
    if (typeof err === 'function') {
      callback = err;
      err = null;
    }
    if (callback === undefined) {
      return new Promise((resolve, reject) => {
        this.destroy(err, (err, data) => {
          return err ? reject(err) : resolve(data);
        });
      });
    }
    if (typeof callback !== 'function') {
      throw new _InvalidArgumentError('invalid callback');
    }
    if (this[_kDestroyed]) {
      if (this[kOnDestroyed]) {
        this[kOnDestroyed].push(callback);
      } else {
        queueMicrotask(() => callback(null, null));
      }
      return;
    }
    if (!err) {
      err = new _ClientDestroyedError();
    }
    this[_kDestroyed] = true;
    this[kOnDestroyed] ??= [];
    this[kOnDestroyed].push(callback);
    const onDestroyed = () => {
      const callbacks = this[kOnDestroyed];
      this[kOnDestroyed] = null;
      for (let i = 0; i < callbacks.length; i++) {
        callbacks[i](null, null);
      }
    };

    // Should not error.
    this[_kDestroy](err).then(() => queueMicrotask(onDestroyed));
  }
  dispatch(opts, handler) {
    if (!handler || typeof handler !== 'object') {
      throw new _InvalidArgumentError('handler must be an object');
    }
    try {
      if (!opts || typeof opts !== 'object') {
        throw new _InvalidArgumentError('opts must be an object.');
      }
      if (opts.dispatcher) {
        throw new _InvalidArgumentError('opts.dispatcher is not supported by instance methods. Pass opts.dispatcher to the top-level undici functions or call the dispatcher instance method directly.');
      }
      if (this[_kDestroyed] || this[kOnDestroyed]) {
        throw new _ClientDestroyedError();
      }
      if (this[_kClosed]) {
        throw new _ClientClosedError();
      }
      return this[_kDispatch](opts, handler);
    } catch (err) {
      if (typeof handler.onResponseError !== 'function') {
        throw err;
      }
      handler.onResponseError(null, err);
      return false;
    }
  }
}
const _cjs_default = DispatcherBase;
export default _cjs_default;
