import * as assert from "node:assert";
import * as net from "node:net";
import * as http from "node:http";
import { parseOrigin as _parseOrigin, bodyLength as _bodyLength, isIterable as _isIterable, errorRequest as _errorRequest, destroy as _destroy } from "../core/util.js";
import { ClientStats as _ClientStats } from "../util/stats.js";
import { channels as _channels } from "../core/diagnostics.js";
import Request from "../core/request.js";
import DispatcherBase from "./dispatcher-base";
import { InvalidArgumentError as _InvalidArgumentError, InformationalError as _InformationalError, ClientDestroyedError as _ClientDestroyedError } from "../core/errors.js";
import buildConnector from "../core/connect.js";
import { kUrl as _kUrl, kServerName as _kServerName, kClient as _kClient, kBusy as _kBusy, kConnect as _kConnect, kResuming as _kResuming, kRunning as _kRunning, kPending as _kPending, kSize as _kSize, kQueue as _kQueue, kConnected as _kConnected, kConnecting as _kConnecting, kNeedDrain as _kNeedDrain, kKeepAliveDefaultTimeout as _kKeepAliveDefaultTimeout, kHostHeader as _kHostHeader, kPendingIdx as _kPendingIdx, kRunningIdx as _kRunningIdx, kError as _kError, kPipelining as _kPipelining, kKeepAliveTimeoutValue as _kKeepAliveTimeoutValue, kMaxHeadersSize as _kMaxHeadersSize, kKeepAliveMaxTimeout as _kKeepAliveMaxTimeout, kKeepAliveTimeoutThreshold as _kKeepAliveTimeoutThreshold, kHeadersTimeout as _kHeadersTimeout, kBodyTimeout as _kBodyTimeout, kStrictContentLength as _kStrictContentLength, kConnector as _kConnector, kMaxRequests as _kMaxRequests, kCounter as _kCounter, kClose as _kClose, kDestroy as _kDestroy, kDispatch as _kDispatch, kLocalAddress as _kLocalAddress, kMaxResponseSize as _kMaxResponseSize, kOnError as _kOnError, kHTTPContext as _kHTTPContext, kMaxConcurrentStreams as _kMaxConcurrentStreams, kHostAuthority as _kHostAuthority, kHTTP2InitialWindowSize as _kHTTP2InitialWindowSize, kHTTP2ConnectionWindowSize as _kHTTP2ConnectionWindowSize, kResume as _kResume, kPingInterval as _kPingInterval } from "../core/symbols.js";
import connectH1 from "./client-h1.js";
import connectH2 from "./client-h2.js";
const kClosedResolve = Symbol('kClosedResolve');
const getDefaultNodeMaxHeaderSize = http && http.maxHeaderSize && Number.isInteger(http.maxHeaderSize) && http.maxHeaderSize > 0 ? () => http.maxHeaderSize : () => {
  throw new _InvalidArgumentError('http module not available or http.maxHeaderSize invalid');
};
const noop = () => {};
function getPipelining(client) {
  return client[_kPipelining] ?? client[_kHTTPContext]?.defaultPipelining ?? 1;
}

// Protocol-aware dispatch ceiling. h1 RFC7230 pipelining is unrelated to h2
// stream multiplexing — over h2 the ceiling is the (server-confirmed)
// maxConcurrentStreams. Before a context is attached we use the h1
// pipelining factor; once h2 attaches the queued requests can drain in
// one batch up to maxConcurrentStreams.
function getMaxConcurrent(client) {
  if (client[_kHTTPContext]?.version === 'h2') {
    return client[_kMaxConcurrentStreams];
  }
  return getPipelining(client);
}

/**
 * @type {import('../../types/client.js').default}
 */
class Client extends DispatcherBase {
  /**
   *
   * @param {string|URL} url
   * @param {import('../../types/client.js').Client.Options} options
   */
  constructor(url, {
    maxHeaderSize,
    headersTimeout,
    socketTimeout,
    requestTimeout,
    connectTimeout,
    bodyTimeout,
    idleTimeout,
    keepAlive,
    keepAliveTimeout,
    maxKeepAliveTimeout,
    keepAliveMaxTimeout,
    keepAliveTimeoutThreshold,
    socketPath,
    pipelining,
    tls,
    strictContentLength,
    maxCachedSessions,
    connect,
    maxRequestsPerClient,
    localAddress,
    maxResponseSize,
    autoSelectFamily,
    autoSelectFamilyAttemptTimeout,
    // h2
    maxConcurrentStreams,
    allowH2,
    useH2c,
    initialWindowSize,
    connectionWindowSize,
    pingInterval,
    webSocket
  } = {}) {
    if (keepAlive !== undefined) {
      throw new _InvalidArgumentError('unsupported keepAlive, use pipelining=0 instead');
    }
    if (socketTimeout !== undefined) {
      throw new _InvalidArgumentError('unsupported socketTimeout, use headersTimeout & bodyTimeout instead');
    }
    if (requestTimeout !== undefined) {
      throw new _InvalidArgumentError('unsupported requestTimeout, use headersTimeout & bodyTimeout instead');
    }
    if (idleTimeout !== undefined) {
      throw new _InvalidArgumentError('unsupported idleTimeout, use keepAliveTimeout instead');
    }
    if (maxKeepAliveTimeout !== undefined) {
      throw new _InvalidArgumentError('unsupported maxKeepAliveTimeout, use keepAliveMaxTimeout instead');
    }
    if (maxHeaderSize != null) {
      if (!Number.isInteger(maxHeaderSize) || maxHeaderSize < 1) {
        throw new _InvalidArgumentError('invalid maxHeaderSize');
      }
    } else {
      // If maxHeaderSize is not provided, use the default value from the http module
      // or if that is not available, throw an error.
      maxHeaderSize = getDefaultNodeMaxHeaderSize();
    }
    if (socketPath != null && typeof socketPath !== 'string') {
      throw new _InvalidArgumentError('invalid socketPath');
    }
    if (connectTimeout != null && (!Number.isFinite(connectTimeout) || connectTimeout < 0)) {
      throw new _InvalidArgumentError('invalid connectTimeout');
    }
    if (keepAliveTimeout != null && (!Number.isFinite(keepAliveTimeout) || keepAliveTimeout <= 0)) {
      throw new _InvalidArgumentError('invalid keepAliveTimeout');
    }
    if (keepAliveMaxTimeout != null && (!Number.isFinite(keepAliveMaxTimeout) || keepAliveMaxTimeout <= 0)) {
      throw new _InvalidArgumentError('invalid keepAliveMaxTimeout');
    }
    if (keepAliveTimeoutThreshold != null && !Number.isFinite(keepAliveTimeoutThreshold)) {
      throw new _InvalidArgumentError('invalid keepAliveTimeoutThreshold');
    }
    if (headersTimeout != null && (!Number.isInteger(headersTimeout) || headersTimeout < 0)) {
      throw new _InvalidArgumentError('headersTimeout must be a positive integer or zero');
    }
    if (bodyTimeout != null && (!Number.isInteger(bodyTimeout) || bodyTimeout < 0)) {
      throw new _InvalidArgumentError('bodyTimeout must be a positive integer or zero');
    }
    if (connect != null && typeof connect !== 'function' && typeof connect !== 'object') {
      throw new _InvalidArgumentError('connect must be a function or an object');
    }
    if (maxRequestsPerClient != null && (!Number.isInteger(maxRequestsPerClient) || maxRequestsPerClient < 0)) {
      throw new _InvalidArgumentError('maxRequestsPerClient must be a positive number');
    }
    if (localAddress != null && (typeof localAddress !== 'string' || net.isIP(localAddress) === 0)) {
      throw new _InvalidArgumentError('localAddress must be valid string IP address');
    }
    if (maxResponseSize != null && (!Number.isInteger(maxResponseSize) || maxResponseSize < -1)) {
      throw new _InvalidArgumentError('maxResponseSize must be a positive number');
    }
    if (autoSelectFamilyAttemptTimeout != null && (!Number.isInteger(autoSelectFamilyAttemptTimeout) || autoSelectFamilyAttemptTimeout < -1)) {
      throw new _InvalidArgumentError('autoSelectFamilyAttemptTimeout must be a positive number');
    }

    // h2
    if (allowH2 != null && typeof allowH2 !== 'boolean') {
      throw new _InvalidArgumentError('allowH2 must be a valid boolean value');
    }
    if (maxConcurrentStreams != null && (typeof maxConcurrentStreams !== 'number' || maxConcurrentStreams < 1)) {
      throw new _InvalidArgumentError('maxConcurrentStreams must be a positive integer, greater than 0');
    }
    if (useH2c != null && typeof useH2c !== 'boolean') {
      throw new _InvalidArgumentError('useH2c must be a valid boolean value');
    }
    if (initialWindowSize != null && (!Number.isInteger(initialWindowSize) || initialWindowSize < 1)) {
      throw new _InvalidArgumentError('initialWindowSize must be a positive integer, greater than 0');
    }
    if (connectionWindowSize != null && (!Number.isInteger(connectionWindowSize) || connectionWindowSize < 1)) {
      throw new _InvalidArgumentError('connectionWindowSize must be a positive integer, greater than 0');
    }
    if (pingInterval != null && (typeof pingInterval !== 'number' || !Number.isInteger(pingInterval) || pingInterval < 0)) {
      throw new _InvalidArgumentError('pingInterval must be a positive integer, greater or equal to 0');
    }
    super({
      webSocket
    });
    if (typeof connect !== 'function') {
      connect = buildConnector({
        ...tls,
        maxCachedSessions,
        allowH2,
        useH2c,
        socketPath,
        timeout: connectTimeout,
        ...(typeof autoSelectFamily === 'boolean' ? {
          autoSelectFamily,
          autoSelectFamilyAttemptTimeout
        } : undefined),
        ...connect
      });
    } else {
      const customConnect = connect;
      connect = (opts, callback) => customConnect({
        ...opts,
        ...(socketPath != null ? {
          socketPath
        } : null),
        ...(allowH2 != null ? {
          allowH2
        } : null)
      }, callback);
    }
    this[_kUrl] = _parseOrigin(url);
    this[_kHostAuthority] = `${this[_kUrl].hostname}${this[_kUrl].port ? `:${this[_kUrl].port}` : ''}`;
    this[_kConnector] = connect;
    this[_kPipelining] = pipelining != null ? pipelining : 1;
    this[_kMaxHeadersSize] = maxHeaderSize;
    this[_kKeepAliveDefaultTimeout] = keepAliveTimeout == null ? 4e3 : keepAliveTimeout;
    this[_kKeepAliveMaxTimeout] = keepAliveMaxTimeout == null ? 600e3 : keepAliveMaxTimeout;
    this[_kKeepAliveTimeoutThreshold] = keepAliveTimeoutThreshold == null ? 2e3 : keepAliveTimeoutThreshold;
    this[_kKeepAliveTimeoutValue] = this[_kKeepAliveDefaultTimeout];
    this[_kServerName] = null;
    this[_kLocalAddress] = localAddress != null ? localAddress : null;
    this[_kResuming] = 0; // 0, idle, 1, scheduled, 2 resuming
    this[_kNeedDrain] = 0; // 0, idle, 1, scheduled, 2 resuming
    this[_kHostHeader] = `host: ${this[_kHostAuthority]}\r\n`;
    this[_kBodyTimeout] = bodyTimeout != null ? bodyTimeout : 300e3;
    this[_kHeadersTimeout] = headersTimeout != null ? headersTimeout : 300e3;
    this[_kStrictContentLength] = strictContentLength == null ? true : strictContentLength;
    this[_kMaxRequests] = maxRequestsPerClient;
    this[kClosedResolve] = null;
    this[_kMaxResponseSize] = maxResponseSize > -1 ? maxResponseSize : -1;
    this[_kHTTPContext] = null;
    // h2
    this[_kMaxConcurrentStreams] = maxConcurrentStreams != null ? maxConcurrentStreams : 100; // Max peerConcurrentStreams for a Node h2 server
    // HTTP/2 window sizes are set to higher defaults than Node.js core for better performance:
    // - initialWindowSize: 262144 (256KB) vs Node.js default 65535 (64KB - 1)
    //   Allows more data to be sent before requiring acknowledgment, improving throughput
    //   especially on high-latency networks. This matches common production HTTP/2 servers.
    // - connectionWindowSize: 524288 (512KB) vs Node.js default (none set)
    //   Provides better flow control for the entire connection across multiple streams.
    this[_kHTTP2InitialWindowSize] = initialWindowSize != null ? initialWindowSize : 262144;
    this[_kHTTP2ConnectionWindowSize] = connectionWindowSize != null ? connectionWindowSize : 524288;
    this[_kPingInterval] = pingInterval != null ? pingInterval : 60e3; // Default ping interval for h2 - 1 minute

    // kQueue is built up of 3 sections separated by
    // the kRunningIdx and kPendingIdx indices.
    // |   complete   |   running   |   pending   |
    //                ^ kRunningIdx ^ kPendingIdx ^ kQueue.length
    // kRunningIdx points to the first running element.
    // kPendingIdx points to the first pending element.
    // This implements a fast queue with an amortized
    // time of O(1).

    this[_kQueue] = [];
    this[_kRunningIdx] = 0;
    this[_kPendingIdx] = 0;
    this[_kResume] = sync => resume(this, sync);
    this[_kOnError] = err => onError(this, err);
  }
  get pipelining() {
    return this[_kPipelining];
  }
  set pipelining(value) {
    this[_kPipelining] = value;
    this[_kResume](true);
  }
  get stats() {
    return new _ClientStats(this);
  }
  get [_kPending]() {
    return this[_kQueue].length - this[_kPendingIdx];
  }
  get [_kRunning]() {
    return this[_kPendingIdx] - this[_kRunningIdx];
  }
  get [_kSize]() {
    return this[_kQueue].length - this[_kRunningIdx];
  }
  get [_kConnected]() {
    return !!this[_kHTTPContext] && !this[_kConnecting] && !this[_kHTTPContext].destroyed;
  }
  get [_kBusy]() {
    // The `kPending > 0` check below is the gate Pool uses to decide whether
    // to spin up an additional Client. For h1 that fan-out is correct —
    // each socket only handles one pipelined request at a time. Once an h2
    // context is attached we want concurrent dispatches to multiplex onto
    // the shared session, so suppress that signal in the h2 case.
    const allowsMux = this[_kHTTPContext]?.version === 'h2';
    return Boolean(this[_kHTTPContext]?.busy(null) || this[_kSize] >= (getMaxConcurrent(this) || 1) || this[_kPending] > 0 && !allowsMux);
  }
  [_kConnect](cb) {
    connect(this);
    this.once('connect', cb);
  }
  [_kDispatch](opts, handler) {
    const request = new Request(this[_kUrl].origin, opts, handler);
    this[_kQueue].push(request);
    if (this[_kResuming]) {
      // Do nothing.
    } else if (_bodyLength(request.body) == null && _isIterable(request.body)) {
      // Wait a tick in case stream/iterator is ended in the same tick.
      this[_kResuming] = 1;
      queueMicrotask(() => resume(this));
    } else {
      this[_kResume](true);
    }
    if (this[_kResuming] && this[_kNeedDrain] !== 2 && this[_kBusy]) {
      this[_kNeedDrain] = 2;
    }
    return this[_kNeedDrain] < 2;
  }
  [_kClose]() {
    // TODO: for H2 we need to gracefully flush the remaining enqueued
    // request and close each stream.
    return new Promise(resolve => {
      if (this[_kSize]) {
        this[kClosedResolve] = resolve;
      } else {
        resolve(null);
      }
    });
  }
  [_kDestroy](err) {
    return new Promise(resolve => {
      const requests = this[_kQueue].splice(this[_kPendingIdx]);
      for (let i = 0; i < requests.length; i++) {
        const request = requests[i];
        if (request != null) {
          _errorRequest(this, request, err);
        }
      }
      const callback = () => {
        if (this[kClosedResolve]) {
          // TODO (fix): Should we error here with ClientDestroyedError?
          this[kClosedResolve]();
          this[kClosedResolve] = null;
        }
        resolve(null);
      };
      if (this[_kHTTPContext]) {
        this[_kHTTPContext].destroy(err, callback);
        this[_kHTTPContext] = null;
      } else {
        queueMicrotask(callback);
      }
      this[_kResume]();
    });
  }
}
function onError(client, err) {
  if (client[_kRunning] === 0 && err.code !== 'UND_ERR_INFO' && err.code !== 'UND_ERR_SOCKET') {
    // Error is not caused by running request and not a recoverable
    // socket error.

    assert(client[_kPendingIdx] === client[_kRunningIdx]);
    const requests = client[_kQueue].splice(client[_kRunningIdx]);
    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      if (request != null) {
        _errorRequest(client, request, err);
      }
    }
    assert(client[_kSize] === 0);
  }
}

/**
 * @param {Client} client
 * @returns {void}
 */
function connect(client) {
  assert(!client[_kConnecting]);
  assert(!client[_kHTTPContext]);
  let {
    host,
    hostname,
    protocol,
    port
  } = client[_kUrl];

  // Resolve ipv6
  if (hostname[0] === '[') {
    const idx = hostname.indexOf(']');
    assert(idx !== -1);
    const ip = hostname.substring(1, idx);
    assert(net.isIPv6(ip));
    hostname = ip;
  }
  client[_kConnecting] = true;
  if (_channels.beforeConnect.hasSubscribers) {
    _channels.beforeConnect.publish({
      connectParams: {
        host,
        hostname,
        protocol,
        port,
        version: client[_kHTTPContext]?.version,
        servername: client[_kServerName],
        localAddress: client[_kLocalAddress]
      },
      connector: client[_kConnector]
    });
  }
  try {
    client[_kConnector]({
      host,
      hostname,
      protocol,
      port,
      servername: client[_kServerName],
      localAddress: client[_kLocalAddress]
    }, (err, socket) => {
      if (err) {
        handleConnectError(client, err, {
          host,
          hostname,
          protocol,
          port
        });
        client[_kResume]();
        return;
      }
      if (client.destroyed) {
        _destroy(socket.on('error', noop), new _ClientDestroyedError());
        client[_kResume]();
        return;
      }
      assert(socket);
      try {
        client[_kHTTPContext] = socket.alpnProtocol === 'h2' ? connectH2(client, socket) : connectH1(client, socket);
      } catch (err) {
        socket.destroy().on('error', noop);
        handleConnectError(client, err, {
          host,
          hostname,
          protocol,
          port
        });
        client[_kResume]();
        return;
      }
      client[_kConnecting] = false;
      socket[_kCounter] = 0;
      socket[_kMaxRequests] = client[_kMaxRequests];
      socket[_kClient] = client;
      socket[_kError] = null;
      if (_channels.connected.hasSubscribers) {
        _channels.connected.publish({
          connectParams: {
            host,
            hostname,
            protocol,
            port,
            version: client[_kHTTPContext]?.version,
            servername: client[_kServerName],
            localAddress: client[_kLocalAddress]
          },
          connector: client[_kConnector],
          socket
        });
      }
      client.emit('connect', client[_kUrl], [client]);
      client[_kResume]();
    });
  } catch (err) {
    handleConnectError(client, err, {
      host,
      hostname,
      protocol,
      port
    });
    client[_kResume]();
  }
}
function handleConnectError(client, err, {
  host,
  hostname,
  protocol,
  port
}) {
  if (client.destroyed) {
    return;
  }
  client[_kConnecting] = false;
  if (_channels.connectError.hasSubscribers) {
    _channels.connectError.publish({
      connectParams: {
        host,
        hostname,
        protocol,
        port,
        version: client[_kHTTPContext]?.version,
        servername: client[_kServerName],
        localAddress: client[_kLocalAddress]
      },
      connector: client[_kConnector],
      error: err
    });
  }
  if (err.code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
    const running = client[_kQueue].splice(client[_kRunningIdx], client[_kRunning]);
    client[_kPendingIdx] = client[_kRunningIdx];
    for (let i = 0; i < running.length; i++) {
      _errorRequest(client, running[i], err);
    }
    while (client[_kPending] > 0 && client[_kQueue][client[_kPendingIdx]].servername === client[_kServerName]) {
      const request = client[_kQueue].splice(client[_kPendingIdx], 1)[0];
      _errorRequest(client, request, err);
    }
  } else {
    onError(client, err);
  }
  client.emit('connectionError', client[_kUrl], [client], err);
}
function emitDrain(client) {
  client[_kNeedDrain] = 0;
  client.emit('drain', client[_kUrl], [client]);
}
function resume(client, sync) {
  if (client[_kResuming] === 2) {
    return;
  }
  client[_kResuming] = 2;
  _resume(client, sync);
  client[_kResuming] = 0;
  if (client[_kRunningIdx] > 256) {
    client[_kQueue].splice(0, client[_kRunningIdx]);
    client[_kPendingIdx] -= client[_kRunningIdx];
    client[_kRunningIdx] = 0;
  }
}
function _resume(client, sync) {
  while (true) {
    if (client.destroyed) {
      assert(client[_kPending] === 0);
      return;
    }
    if (client[kClosedResolve] && !client[_kSize]) {
      client[kClosedResolve]();
      client[kClosedResolve] = null;
      return;
    }
    if (client[_kHTTPContext]) {
      client[_kHTTPContext].resume();
    }
    if (client[_kBusy]) {
      client[_kNeedDrain] = 2;
    } else if (client[_kNeedDrain] === 2) {
      if (sync) {
        client[_kNeedDrain] = 1;
        queueMicrotask(() => emitDrain(client));
      } else {
        emitDrain(client);
      }
      continue;
    }
    if (client[_kPending] === 0) {
      return;
    }
    if (client[_kRunning] >= (getMaxConcurrent(client) || 1)) {
      return;
    }
    const request = client[_kQueue][client[_kPendingIdx]];
    if (request === null) {
      return;
    }
    if (client[_kUrl].protocol === 'https:' && client[_kServerName] !== request.servername) {
      if (client[_kRunning] > 0) {
        return;
      }
      client[_kServerName] = request.servername;
      client[_kHTTPContext]?.destroy(new _InformationalError('servername changed'), () => {
        client[_kHTTPContext] = null;
        resume(client);
      });
    }
    if (client[_kConnecting]) {
      return;
    }
    if (!client[_kHTTPContext]) {
      connect(client);
      return;
    }
    if (client[_kHTTPContext].destroyed) {
      return;
    }
    if (client[_kHTTPContext].busy(request)) {
      return;
    }
    if (!request.aborted && client[_kHTTPContext].write(request)) {
      client[_kPendingIdx]++;
    } else {
      client[_kQueue].splice(client[_kPendingIdx], 1);
    }
  }
}
const _cjs_default = Client;
export default _cjs_default;
