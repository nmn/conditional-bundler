import { PoolBase as _PoolBase, kClients as _kClients, kNeedDrain as _kNeedDrain, kAddClient as _kAddClient, kGetDispatcher as _kGetDispatcher, kHasDispatcher as _kHasDispatcher, kRemoveClient as _kRemoveClient } from "./pool-base";
import Client from "./client";
import { InvalidArgumentError as _InvalidArgumentError } from "../core/errors";
import { parseOrigin as _parseOrigin, deepClone as _deepClone } from "../core/util";
import { kUrl as _kUrl } from "../core/symbols";
import buildConnector from "../core/connect";
const kOptions = Symbol('options');
const kConnections = Symbol('connections');
const kFactory = Symbol('factory');
const kIndex = Symbol('index');
function defaultFactory(origin, opts) {
  return new Client(origin, opts);
}
class RoundRobinPool extends _PoolBase {
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
        socketPath,
        timeout: connectTimeout,
        ...(typeof autoSelectFamily === 'boolean' ? {
          autoSelectFamily,
          autoSelectFamilyAttemptTimeout
        } : undefined),
        ...connect
      });
    }
    super();
    this[kConnections] = connections || null;
    this[_kUrl] = _parseOrigin(origin);
    this[kOptions] = {
      ..._deepClone(options),
      connect,
      allowH2,
      clientTtl,
      socketPath
    };
    this[kFactory] = factory;
    this[kIndex] = -1;
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
      for (const target of targets) {
        const idx = this[_kClients].indexOf(target);
        if (idx !== -1) {
          this[_kClients].splice(idx, 1);
        }
      }
    });
  }
  [_kGetDispatcher]() {
    const clientTtlOption = this[kOptions].clientTtl;

    // If we have no clients yet, create one
    if (this[_kClients].length === 0) {
      const dispatcher = this[kFactory](this[_kUrl], this[kOptions]);
      this[_kAddClient](dispatcher);
      return dispatcher;
    }

    // Round-robin through existing clients
    let checked = 0;
    while (checked < this[_kClients].length) {
      this[kIndex] = (this[kIndex] + 1) % this[_kClients].length;
      const client = this[_kClients][this[kIndex]];

      // Check if client is stale (TTL expired)
      if (clientTtlOption != null && clientTtlOption > 0 && client.ttl && Date.now() - client.ttl > clientTtlOption) {
        this[_kRemoveClient](client);
        this[kIndex]--;
        continue;
      }

      // Return client if it's not draining
      if (!client[_kNeedDrain]) {
        return client;
      }
      checked++;
    }

    // All clients are busy, create a new one if we haven't reached the limit
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
        if (i <= this[kIndex]) {
          this[kIndex]--;
        }
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
const _cjs_default = RoundRobinPool;
export default _cjs_default;
