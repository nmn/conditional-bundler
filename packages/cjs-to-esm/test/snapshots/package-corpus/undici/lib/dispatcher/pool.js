import { PoolBase as _PoolBase, kClients as _kClients, kNeedDrain as _kNeedDrain, kAddClient as _kAddClient, kGetDispatcher as _kGetDispatcher, kHasDispatcher as _kHasDispatcher, kRemoveClient as _kRemoveClient } from "./pool-base";
import Client from "./client";
import { InvalidArgumentError as _InvalidArgumentError } from "../core/errors";
import { parseOrigin as _parseOrigin, deepClone as _deepClone } from "../core/util";
import { kUrl as _kUrl } from "../core/symbols";
import buildConnector from "../core/connect";
const kOptions = Symbol('options');
const kConnections = Symbol('connections');
const kFactory = Symbol('factory');
function defaultFactory(origin, opts) {
  return new Client(origin, opts);
}
class Pool extends _PoolBase {
  constructor(origin, {
    connections,
    factory = defaultFactory,
    connect,
    connectTimeout,
    tls,
    maxCachedSessions,
    socketPath,
    autoSelectFamily,
    autoSelectFamilyAttemptTimeout,
    allowH2,
    useH2c,
    clientTtl,
    ...options
  } = {}) {
    if (connections != null && (!Number.isFinite(connections) || connections < 0)) {
      throw new _InvalidArgumentError('invalid connections');
    }
    if (typeof factory !== 'function') {
      throw new _InvalidArgumentError('factory must be a function.');
    }
    if (connect != null && typeof connect !== 'function' && typeof connect !== 'object') {
      throw new _InvalidArgumentError('connect must be a function or an object');
    }
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
    }
    super(options);
    this[kConnections] = connections || null;
    this[_kUrl] = _parseOrigin(origin);
    this[kOptions] = {
      ..._deepClone(options),
      connect,
      allowH2,
      useH2c,
      clientTtl,
      socketPath
    };
    this[kFactory] = factory;
    this.on('connect', (origin, targets) => {
      if (clientTtl != null && clientTtl > 0) {
        for (const target of targets) {
          Object.assign(target, {
            ttl: Date.now()
          });
        }
      }
    });
    this.on('connectionError', (origin, targets, error) => {
      // If a connection error occurs, we remove the client from the pool,
      // and emit a connectionError event. They will not be re-used.
      // Fixes https://github.com/nodejs/undici/issues/3895
      for (const target of targets) {
        // Do not use kRemoveClient here, as it will close the client,
        // but the client cannot be closed in this state.
        const idx = this[_kClients].indexOf(target);
        if (idx !== -1) {
          this[_kClients].splice(idx, 1);
        }
      }
    });
  }
  [_kGetDispatcher]() {
    const clientTtlOption = this[kOptions].clientTtl;
    for (let i = 0; i < this[_kClients].length; i++) {
      const client = this[_kClients][i];

      // check ttl of client and if it's stale, remove it from the pool
      if (clientTtlOption != null && clientTtlOption > 0 && client.ttl && Date.now() - client.ttl > clientTtlOption) {
        this[_kRemoveClient](client);
        i--;
      } else if (!client[_kNeedDrain]) {
        return client;
      }
    }
    if (!this[kConnections] || this[_kClients].length < this[kConnections]) {
      const dispatcher = this[kFactory](this[_kUrl], this[kOptions]);
      this[_kAddClient](dispatcher);
      return dispatcher;
    }
  }
  [_kHasDispatcher]() {
    const clientTtlOption = this[kOptions].clientTtl;
    for (let i = 0; i < this[_kClients].length; i++) {
      const client = this[_kClients][i];
      if (clientTtlOption != null && clientTtlOption > 0 && client.ttl && Date.now() - client.ttl > clientTtlOption) {
        this[_kRemoveClient](client);
        i--;
      } else if (!client[_kNeedDrain]) {
        return true;
      }
    }
    if (!this[kConnections] || this[_kClients].length < this[kConnections]) {
      const dispatcher = this[kFactory](this[_kUrl], this[kOptions]);
      this[_kAddClient](dispatcher);
      return true;
    }
    return false;
  }
}
const _cjs_default = Pool;
export default _cjs_default;
