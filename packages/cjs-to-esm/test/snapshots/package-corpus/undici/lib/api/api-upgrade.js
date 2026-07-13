import { InvalidArgumentError as _InvalidArgumentError, SocketError as _SocketError } from "../core/errors";
import * as _cjs_import from "node:async_hooks";
import * as assert from "node:assert";
import { getSocketInfo as _getSocketInfo, parseRawHeaders as _parseRawHeaders } from "../core/util";
import { kHTTP2Stream as _kHTTP2Stream } from "../core/symbols";
import { addSignal as _addSignal, removeSignal as _removeSignal } from "./abort-signal";
const {
  AsyncResource
} = _cjs_import;
class UpgradeHandler extends AsyncResource {
  constructor(opts, callback) {
    if (!opts || typeof opts !== 'object') {
      throw new _InvalidArgumentError('invalid opts');
    }
    if (typeof callback !== 'function') {
      throw new _InvalidArgumentError('invalid callback');
    }
    const {
      signal,
      opaque,
      responseHeaders
    } = opts;
    if (signal && typeof signal.on !== 'function' && typeof signal.addEventListener !== 'function') {
      throw new _InvalidArgumentError('signal must be an EventEmitter or EventTarget');
    }
    super('UNDICI_UPGRADE');
    this.responseHeaders = responseHeaders || null;
    this.opaque = opaque || null;
    this.callback = callback;
    this.abort = null;
    this.context = null;
    _addSignal(this, signal);
  }
  onRequestStart(controller, context) {
    if (this.reason) {
      controller.abort(this.reason);
      return;
    }
    assert(this.callback);
    this.abort = reason => controller.abort(reason);
    this.context = context;
  }
  onResponseStart() {
    throw new _SocketError('bad upgrade', null);
  }
  onRequestUpgrade(controller, statusCode, headers, socket) {
    const expectedStatusCode = socket[_kHTTP2Stream] === true ? 200 : 101;
    if (statusCode !== expectedStatusCode) {
      const socketInfo = socket[_kHTTP2Stream] === true ? null : _getSocketInfo(socket);
      controller.abort(new _SocketError('bad upgrade', socketInfo));
      return;
    }
    const {
      callback,
      opaque,
      context
    } = this;
    _removeSignal(this);
    this.callback = null;
    const rawHeaders = controller?.rawHeaders;
    const responseHeaders = this.responseHeaders === 'raw' ? _parseRawHeaders(rawHeaders) : headers;
    this.runInAsyncScope(callback, null, null, {
      headers: responseHeaders,
      socket,
      opaque,
      context
    });
  }
  onResponseError(_controller, err) {
    const {
      callback,
      opaque
    } = this;
    _removeSignal(this);
    if (callback) {
      this.callback = null;
      queueMicrotask(() => {
        this.runInAsyncScope(callback, null, err, {
          opaque
        });
      });
    }
  }
}
function upgrade(opts, callback) {
  if (callback === undefined) {
    return new Promise((resolve, reject) => {
      upgrade.call(this, opts, (err, data) => {
        return err ? reject(err) : resolve(data);
      });
    });
  }
  try {
    const upgradeHandler = new UpgradeHandler(opts, callback);
    const upgradeOpts = {
      ...opts,
      method: opts.method || 'GET',
      upgrade: opts.protocol || 'Websocket'
    };
    this.dispatch(upgradeOpts, upgradeHandler);
  } catch (err) {
    if (typeof callback !== 'function') {
      throw err;
    }
    const opaque = opts?.opaque;
    queueMicrotask(() => callback(err, {
      opaque
    }));
  }
}
const _cjs_default = upgrade;
export default _cjs_default;
