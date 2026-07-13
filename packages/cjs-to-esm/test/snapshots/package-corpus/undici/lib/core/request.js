import { InvalidArgumentError as _InvalidArgumentError, NotSupportedError as _NotSupportedError } from "./errors";
import * as assert from "node:assert";
import { isValidHTTPToken as _isValidHTTPToken, isValidHeaderValue as _isValidHeaderValue, isStream as _isStream, destroy as _destroy, isBuffer as _isBuffer, isFormDataLike as _isFormDataLike, isIterable as _isIterable, hasSafeIterator as _hasSafeIterator, isBlobLike as _isBlobLike, serializePathWithQuery as _serializePathWithQuery, parseHeaders as _parseHeaders, assertRequestHandler as _assertRequestHandler, getServerName as _getServerName, normalizedMethodRecords as _normalizedMethodRecords, getProtocolFromUrlString as _getProtocolFromUrlString } from "./util";
import { channels as _channels } from "./diagnostics.js";
import { headerNameLowerCasedRecord as _headerNameLowerCasedRecord } from "./constants";
// Verifies that a given path is valid does not contain control chars \x00 to \x20
const invalidPathRegex = /[^\u0021-\u00ff]/;
function isValidContentLengthHeaderValue(val) {
  if (typeof val !== 'string' || val.length === 0) {
    return false;
  }
  for (let i = 0; i < val.length; i++) {
    const charCode = val.charCodeAt(i);
    if (charCode < 48 || charCode > 57) {
      return false;
    }
  }
  return true;
}
const kHandler = Symbol('handler');
const kController = Symbol('controller');
const kResume = Symbol('resume');
class RequestController {
  #paused = false;
  #reason = null;
  #aborted = false;
  #abort;
  [kResume] = null;
  rawHeaders = null;
  rawTrailers = null;
  constructor(abort) {
    this.#abort = abort;
  }
  pause() {
    this.#paused = true;
  }
  resume() {
    if (this.#paused) {
      this.#paused = false;
      this[kResume]?.();
    }
  }
  abort(reason) {
    if (!this.#aborted) {
      this.#aborted = true;
      this.#reason = reason;
      this.#abort(reason);
    }
  }
  get aborted() {
    return this.#aborted;
  }
  get reason() {
    return this.#reason;
  }
  get paused() {
    return this.#paused;
  }
}
class Request {
  constructor(origin, {
    path,
    method,
    body,
    headers,
    query,
    idempotent,
    blocking,
    upgrade,
    headersTimeout,
    bodyTimeout,
    reset,
    expectContinue,
    servername,
    throwOnError,
    maxRedirections,
    typeOfService
  }, handler) {
    if (typeof path !== 'string') {
      throw new _InvalidArgumentError('path must be a string');
    } else if (path[0] !== '/' && !(path.startsWith('http://') || path.startsWith('https://')) && method !== 'CONNECT') {
      throw new _InvalidArgumentError('path must be an absolute URL or start with a slash');
    } else if (invalidPathRegex.test(path)) {
      throw new _InvalidArgumentError('invalid request path');
    }
    if (typeof method !== 'string') {
      throw new _InvalidArgumentError('method must be a string');
    } else if (_normalizedMethodRecords[method] === undefined && !_isValidHTTPToken(method)) {
      throw new _InvalidArgumentError('invalid request method');
    }
    if (upgrade && typeof upgrade !== 'string') {
      throw new _InvalidArgumentError('upgrade must be a string');
    }
    if (upgrade && !_isValidHeaderValue(upgrade)) {
      throw new _InvalidArgumentError('invalid upgrade header');
    }
    if (headersTimeout != null && (!Number.isFinite(headersTimeout) || headersTimeout < 0)) {
      throw new _InvalidArgumentError('invalid headersTimeout');
    }
    if (bodyTimeout != null && (!Number.isFinite(bodyTimeout) || bodyTimeout < 0)) {
      throw new _InvalidArgumentError('invalid bodyTimeout');
    }
    if (reset != null && typeof reset !== 'boolean') {
      throw new _InvalidArgumentError('invalid reset');
    }
    if (expectContinue != null && typeof expectContinue !== 'boolean') {
      throw new _InvalidArgumentError('invalid expectContinue');
    }
    if (throwOnError != null) {
      throw new _InvalidArgumentError('invalid throwOnError');
    }
    if (maxRedirections != null && maxRedirections !== 0) {
      throw new _InvalidArgumentError('maxRedirections is not supported, use the redirect interceptor');
    }
    if (typeOfService != null && (!Number.isInteger(typeOfService) || typeOfService < 0 || typeOfService > 255)) {
      throw new _InvalidArgumentError('typeOfService must be an integer between 0 and 255');
    }
    this.headersTimeout = headersTimeout;
    this.bodyTimeout = bodyTimeout;
    this.method = method;
    this.typeOfService = typeOfService ?? 0;
    this.abort = null;
    if (body == null) {
      this.body = null;
    } else if (_isStream(body)) {
      this.body = body;
      const rState = this.body._readableState;
      if (!rState || !rState.autoDestroy) {
        this.endHandler = function autoDestroy() {
          _destroy(this);
        };
        this.body.on('end', this.endHandler);
      }
      this.errorHandler = err => {
        if (this.abort) {
          this.abort(err);
        } else {
          this.error = err;
        }
      };
      this.body.on('error', this.errorHandler);
    } else if (_isBuffer(body)) {
      this.body = body.byteLength ? body : null;
    } else if (ArrayBuffer.isView(body)) {
      this.body = body.buffer.byteLength ? Buffer.from(body.buffer, body.byteOffset, body.byteLength) : null;
    } else if (body instanceof ArrayBuffer) {
      this.body = body.byteLength ? Buffer.from(body) : null;
    } else if (typeof body === 'string') {
      this.body = body.length ? Buffer.from(body) : null;
    } else if (_isFormDataLike(body) || _isIterable(body) || _isBlobLike(body)) {
      this.body = body;
    } else {
      throw new _InvalidArgumentError('body must be a string, a Buffer, a Readable stream, an iterable, or an async iterable');
    }
    this.completed = false;
    this.aborted = false;
    this.upgrade = upgrade || null;
    this.path = query ? _serializePathWithQuery(path, query) : path;

    // TODO: shall we maybe standardize it to an URL object?
    this.origin = origin;
    this.protocol = _getProtocolFromUrlString(origin);
    this.idempotent = idempotent == null ? method === 'HEAD' || method === 'GET' || method === 'QUERY' : idempotent;
    this.blocking = blocking ?? this.method !== 'HEAD';
    this.reset = reset == null ? null : reset;
    this.host = null;
    this.contentLength = null;
    this.contentType = null;
    this.headers = [];

    // Only for H2
    this.expectContinue = expectContinue != null ? expectContinue : false;
    if (Array.isArray(headers)) {
      if (headers.length % 2 !== 0) {
        throw new _InvalidArgumentError('headers array must be even');
      }
      for (let i = 0; i < headers.length; i += 2) {
        processHeader(this, headers[i], headers[i + 1]);
      }
    } else if (headers && typeof headers === 'object') {
      if (_hasSafeIterator(headers)) {
        for (const header of headers) {
          if (!Array.isArray(header) || header.length !== 2) {
            throw new _InvalidArgumentError('headers must be in key-value pair format');
          }
          processHeader(this, header[0], header[1]);
        }
      } else {
        const keys = Object.keys(headers);
        for (let i = 0; i < keys.length; ++i) {
          processHeader(this, keys[i], headers[keys[i]]);
        }
      }
    } else if (headers != null) {
      throw new _InvalidArgumentError('headers must be an object or an array');
    }
    _assertRequestHandler(handler, method, upgrade);
    this.servername = servername || _getServerName(this.host) || null;
    this[kHandler] = handler;
    if (_channels.create.hasSubscribers) {
      _channels.create.publish({
        request: this
      });
    }
  }
  onBodySent(chunk) {
    if (_channels.bodyChunkSent.hasSubscribers) {
      _channels.bodyChunkSent.publish({
        request: this,
        chunk
      });
    }
    if (this[kHandler].onBodySent) {
      try {
        return this[kHandler].onBodySent(chunk);
      } catch (err) {
        this.abort(err);
      }
    }
  }
  onRequestSent() {
    if (_channels.bodySent.hasSubscribers) {
      _channels.bodySent.publish({
        request: this
      });
    }
    if (this[kHandler].onRequestSent) {
      try {
        return this[kHandler].onRequestSent();
      } catch (err) {
        this.abort(err);
      }
    }
  }
  onRequestStart(abort, context) {
    assert(!this.aborted);
    assert(!this.completed);
    this[kController] = new RequestController(abort);
    if (this.error) {
      this[kController].abort(this.error);
      return;
    }
    this.abort = abort;
    return this[kHandler].onRequestStart(this[kController], context);
  }
  onResponseStarted() {
    return this[kHandler].onResponseStarted?.();
  }
  onResponseStart(statusCode, headers, resume, statusText) {
    assert(!this.aborted);
    assert(!this.completed);
    if (_channels.headers.hasSubscribers) {
      _channels.headers.publish({
        request: this,
        response: {
          statusCode,
          headers,
          statusText
        }
      });
    }
    const controller = this[kController];
    if (controller) {
      controller[kResume] = resume;
      controller.rawHeaders = headers;
    }
    const parsedHeaders = Array.isArray(headers) ? _parseHeaders(headers) : headers;
    try {
      this[kHandler].onResponseStart?.(controller, statusCode, parsedHeaders, statusText);
      return !controller?.paused;
    } catch (err) {
      this.abort(err);
      return false;
    }
  }
  onResponseData(chunk) {
    assert(!this.aborted);
    assert(!this.completed);
    if (_channels.bodyChunkReceived.hasSubscribers) {
      _channels.bodyChunkReceived.publish({
        request: this,
        chunk
      });
    }
    const controller = this[kController];
    try {
      this[kHandler].onResponseData?.(controller, chunk);
      return !controller?.paused;
    } catch (err) {
      this.abort(err);
      return false;
    }
  }
  onRequestUpgrade(statusCode, headers, socket) {
    assert(!this.aborted);
    assert(!this.completed);
    const controller = this[kController];
    if (controller) {
      controller.rawHeaders = headers;
    }
    const parsedHeaders = Array.isArray(headers) ? _parseHeaders(headers) : headers;
    return this[kHandler].onRequestUpgrade?.(controller, statusCode, parsedHeaders, socket);
  }
  onResponseEnd(trailers) {
    this.onFinally();
    assert(!this.aborted);
    assert(!this.completed);
    this.completed = true;
    if (_channels.trailers.hasSubscribers) {
      _channels.trailers.publish({
        request: this,
        trailers
      });
    }
    const controller = this[kController];
    if (controller) {
      controller.rawTrailers = trailers;
    }
    const parsedTrailers = Array.isArray(trailers) ? _parseHeaders(trailers) : trailers;
    try {
      return this[kHandler].onResponseEnd?.(controller, parsedTrailers);
    } catch (err) {
      // TODO (fix): This might be a bad idea?
      this.onResponseError(err);
    }
  }
  onResponseError(error) {
    this.onFinally();
    if (_channels.error.hasSubscribers) {
      _channels.error.publish({
        request: this,
        error
      });
    }
    if (this.aborted) {
      return;
    }
    this.aborted = true;
    const controller = this[kController];
    return this[kHandler].onResponseError?.(controller, error);
  }
  onFinally() {
    if (this.errorHandler) {
      this.body.off('error', this.errorHandler);
      this.errorHandler = null;
    }
    if (this.endHandler) {
      this.body.off('end', this.endHandler);
      this.endHandler = null;
    }
  }
  addHeader(key, value) {
    processHeader(this, key, value);
    return this;
  }
}
function processHeader(request, key, val) {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    throw new _InvalidArgumentError(`invalid ${key} header`);
  } else if (val === undefined) {
    return;
  }
  let headerName = _headerNameLowerCasedRecord[key];
  if (headerName === undefined) {
    headerName = key.toLowerCase();
    if (_headerNameLowerCasedRecord[headerName] === undefined && !_isValidHTTPToken(headerName)) {
      throw new _InvalidArgumentError('invalid header key');
    }
  }
  if (Array.isArray(val)) {
    const arr = [];
    for (let i = 0; i < val.length; i++) {
      if (typeof val[i] === 'string') {
        if (!_isValidHeaderValue(val[i])) {
          throw new _InvalidArgumentError(`invalid ${key} header`);
        }
        arr.push(val[i]);
      } else if (val[i] === null) {
        arr.push('');
      } else if (typeof val[i] === 'object') {
        throw new _InvalidArgumentError(`invalid ${key} header`);
      } else {
        arr.push(`${val[i]}`);
      }
    }
    val = arr;
  } else if (typeof val === 'string') {
    if (!_isValidHeaderValue(val)) {
      throw new _InvalidArgumentError(`invalid ${key} header`);
    }
  } else if (val === null) {
    val = '';
  } else {
    val = `${val}`;
  }
  if (headerName === 'host') {
    if (request.host !== null) {
      throw new _InvalidArgumentError('duplicate host header');
    }
    if (typeof val !== 'string') {
      throw new _InvalidArgumentError('invalid host header');
    }
    // Consumed by Client
    request.host = val;
  } else if (headerName === 'content-length') {
    if (request.contentLength !== null) {
      throw new _InvalidArgumentError('duplicate content-length header');
    }
    if (!isValidContentLengthHeaderValue(val)) {
      throw new _InvalidArgumentError('invalid content-length header');
    }
    request.contentLength = parseInt(val, 10);
  } else if (request.contentType === null && headerName === 'content-type') {
    request.contentType = val;
    request.headers.push(key, val);
  } else if (headerName === 'transfer-encoding' || headerName === 'keep-alive' || headerName === 'upgrade') {
    throw new _InvalidArgumentError(`invalid ${headerName} header`);
  } else if (headerName === 'connection') {
    // Per RFC 7230 Section 6.1, Connection header can contain
    // a comma-separated list of connection option tokens (header names)
    const value = typeof val === 'string' ? val : null;
    if (value === null) {
      throw new _InvalidArgumentError('invalid connection header');
    }
    for (const token of value.toLowerCase().split(',')) {
      const trimmed = token.trim();
      if (!_isValidHTTPToken(trimmed)) {
        throw new _InvalidArgumentError('invalid connection header');
      }
      if (trimmed === 'close') {
        request.reset = true;
      }
    }
  } else if (headerName === 'expect') {
    throw new _NotSupportedError('expect header not supported');
  } else {
    request.headers.push(key, val);
  }
}
const _cjs_default = Request;
export default _cjs_default;
