import * as assert from "node:assert";
import * as _cjs_import from "node:async_hooks";
import { Readable as _Readable } from "./readable";
import { InvalidArgumentError as _InvalidArgumentError, RequestAbortedError as _RequestAbortedError } from "../core/errors";
import { isStream as _isStream, destroy as _destroy, addAbortListener as _addAbortListener, parseRawHeaders as _parseRawHeaders } from "../core/util";
const {
  AsyncResource
} = _cjs_import;
function noop() {}
export class RequestHandler extends AsyncResource {
  constructor(opts, callback) {
    if (!opts || typeof opts !== 'object') {
      throw new _InvalidArgumentError('invalid opts');
    }
    const {
      signal,
      method,
      opaque,
      body,
      onInfo,
      responseHeaders,
      highWaterMark
    } = opts;
    try {
      if (typeof callback !== 'function') {
        throw new _InvalidArgumentError('invalid callback');
      }
      if (highWaterMark != null && (!Number.isFinite(highWaterMark) || highWaterMark < 0)) {
        throw new _InvalidArgumentError('invalid highWaterMark');
      }
      if (signal && typeof signal.on !== 'function' && typeof signal.addEventListener !== 'function') {
        throw new _InvalidArgumentError('signal must be an EventEmitter or EventTarget');
      }
      if (method === 'CONNECT') {
        throw new _InvalidArgumentError('invalid method');
      }
      if (onInfo && typeof onInfo !== 'function') {
        throw new _InvalidArgumentError('invalid onInfo callback');
      }
      super('UNDICI_REQUEST');
    } catch (err) {
      if (_isStream(body)) {
        _destroy(body.on('error', noop), err);
      }
      throw err;
    }
    this.method = method;
    this.responseHeaders = responseHeaders || null;
    this.opaque = opaque || null;
    this.callback = callback;
    this.res = null;
    this.abort = null;
    this.body = body;
    this.trailers = {};
    this.context = null;
    this.controller = null;
    this.onInfo = onInfo || null;
    this.highWaterMark = highWaterMark;
    this.reason = null;
    this.removeAbortListener = null;
    if (signal?.aborted) {
      this.reason = signal.reason ?? new _RequestAbortedError();
    } else if (signal) {
      this.removeAbortListener = _addAbortListener(signal, () => {
        this.reason = signal.reason ?? new _RequestAbortedError();
        if (this.res) {
          // Null the reference before destroying, mirroring onResponseError, so
          // that chunks flushed after the abort (e.g. an async decompressor
          // flush) are dropped by the `!this.res` guard in onResponseData
          // instead of being pushed into the torn-down stream.
          const res = this.res;
          this.res = null;
          _destroy(res.on('error', noop), this.reason);
        } else if (this.abort) {
          this.abort(this.reason);
        }
      });
    }
  }
  onRequestStart(controller, context) {
    if (this.reason) {
      controller.abort(this.reason);
      return;
    }
    assert(this.callback);
    this.controller = controller;
    this.abort = reason => controller.abort(reason);
    this.context = context;
  }
  onResponseStart(controller, statusCode, headers, statusText) {
    const {
      callback,
      opaque,
      context,
      responseHeaders,
      highWaterMark
    } = this;
    const rawHeaders = controller?.rawHeaders;
    const responseHeaderData = responseHeaders === 'raw' ? _parseRawHeaders(rawHeaders) : headers;
    if (statusCode < 200) {
      if (this.onInfo) {
        this.onInfo({
          statusCode,
          headers: responseHeaderData
        });
      }
      return;
    }
    const parsedHeaders = headers;
    const contentType = parsedHeaders?.['content-type'];
    const contentLength = parsedHeaders?.['content-length'];
    const res = new _Readable({
      resume: () => controller.resume(),
      abort: reason => controller.abort(reason),
      contentType,
      contentLength: this.method !== 'HEAD' && contentLength ? Number(contentLength) : null,
      highWaterMark
    });
    if (this.removeAbortListener) {
      res.on('close', this.removeAbortListener);
      this.removeAbortListener = null;
    }
    this.callback = null;
    this.res = res;
    if (callback !== null) {
      try {
        this.runInAsyncScope(callback, null, null, {
          statusCode,
          statusText,
          headers: responseHeaderData,
          trailers: this.trailers,
          opaque,
          body: res,
          context
        });
      } catch (err) {
        // If the callback throws synchronously, we need to handle it
        // Remove reference to res to allow res being garbage collected
        this.res = null;

        // Destroy the response stream
        _destroy(res.on('error', noop), err);

        // Use queueMicrotask to re-throw the error so it reaches uncaughtException
        queueMicrotask(() => {
          throw err;
        });
      }
    }
  }
  onResponseData(controller, chunk) {
    if (!this.res) {
      return;
    }
    if (this.res.push(chunk) === false) {
      controller.pause();
    }
  }
  onResponseEnd(_controller, trailers) {
    if (trailers && typeof trailers === 'object') {
      for (const key of Object.keys(trailers)) {
        if (key === '__proto__') {
          Object.defineProperty(this.trailers, key, {
            value: trailers[key],
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          this.trailers[key] = trailers[key];
        }
      }
    }
    this.res?.push(null);
  }
  onResponseError(_controller, err) {
    const {
      res,
      callback,
      body,
      opaque
    } = this;
    if (callback) {
      // TODO: Does this need queueMicrotask?
      this.callback = null;
      queueMicrotask(() => {
        this.runInAsyncScope(callback, null, err, {
          opaque
        });
      });
    }
    if (res) {
      this.res = null;
      // Ensure all queued handlers are invoked before destroying res.
      queueMicrotask(() => {
        _destroy(res.on('error', noop), err);
      });
    }
    if (body) {
      this.body = null;
      if (_isStream(body)) {
        body.on('error', noop);
        _destroy(body, err);
      }
    }
    if (this.removeAbortListener) {
      this.removeAbortListener();
      this.removeAbortListener = null;
    }
  }
}
function request(opts, callback) {
  if (callback === undefined) {
    return new Promise((resolve, reject) => {
      request.call(this, opts, (err, data) => {
        return err ? reject(err) : resolve(data);
      });
    });
  }
  try {
    const handler = new RequestHandler(opts, callback);
    this.dispatch(opts, handler);
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
const _cjs_default = request;
_cjs_default["RequestHandler"] = RequestHandler;
export default _cjs_default;
