import { InvalidArgumentError as _InvalidArgumentError, MaxOriginsReachedError as _MaxOriginsReachedError } from "../core/errors";
import { kBusy as _kBusy, kClients as _kClients, kConnected as _kConnected, kRunning as _kRunning, kClose as _kClose, kDestroy as _kDestroy, kDispatch as _kDispatch, kUrl as _kUrl } from "../core/symbols";
import DispatcherBase from "./dispatcher-base";
import Pool from "./pool";
import Client from "./client";
import { deepClone as _deepClone } from "../core/util";
const kOnConnect = Symbol('onConnect');
const kOnDisconnect = Symbol('onDisconnect');
const kOnConnectionError = Symbol('onConnectionError');
const kOnDrain = Symbol('onDrain');
const kFactory = Symbol('factory');
const kOptions = Symbol('options');
const kOrigins = Symbol('origins');
function defaultFactory(origin, opts) {
  return opts && opts.connections === 1 ? new Client(origin, opts) : new Pool(origin, opts);
}
class Agent extends DispatcherBase {
  constructor({
    factory = defaultFactory,
    maxOrigins = Infinity,
    connect,
    ...options
  } = {}) {
    if (typeof factory !== 'function') {
      throw new _InvalidArgumentError('factory must be a function.');
    }
    if (connect != null && typeof connect !== 'function' && typeof connect !== 'object') {
      throw new _InvalidArgumentError('connect must be a function or an object');
    }
    if (typeof maxOrigins !== 'number' || Number.isNaN(maxOrigins) || maxOrigins <= 0) {
      throw new _InvalidArgumentError('maxOrigins must be a number greater than 0');
    }
    super(options);
    if (connect && typeof connect !== 'function') {
      connect = {
        ...connect
      };
    }
    this[kOptions] = {
      ..._deepClone(options),
      maxOrigins,
      connect
    };
    this[kFactory] = factory;
    this[_kClients] = new Map();
    this[kOrigins] = new Set();
    this[kOnDrain] = (origin, targets) => {
      this.emit('drain', origin, [this, ...targets]);
    };
    this[kOnConnect] = (origin, targets) => {
      this.emit('connect', origin, [this, ...targets]);
    };
    this[kOnDisconnect] = (origin, targets, err) => {
      this.emit('disconnect', origin, [this, ...targets], err);
    };
    this[kOnConnectionError] = (origin, targets, err) => {
      this.emit('connectionError', origin, [this, ...targets], err);
    };
  }
  get [_kRunning]() {
    let ret = 0;
    for (const dispatcher of this[_kClients].values()) {
      ret += dispatcher[_kRunning];
    }
    return ret;
  }
  [_kDispatch](opts, handler) {
    let origin;
    if (opts.origin && (typeof opts.origin === 'string' || opts.origin instanceof URL)) {
      origin = String(opts.origin);
    } else {
      throw new _InvalidArgumentError('opts.origin must be a non-empty string or URL.');
    }
    const allowH2 = opts.allowH2 ?? this[kOptions].allowH2;
    const key = allowH2 === false ? `${origin}#http1-only` : origin;
    if (this[kOrigins].size >= this[kOptions].maxOrigins && !this[kOrigins].has(origin)) {
      throw new _MaxOriginsReachedError();
    }
    let dispatcher = this[_kClients].get(key);
    if (!dispatcher) {
      dispatcher = this[kFactory](opts.origin, allowH2 === false ? {
        ...this[kOptions],
        allowH2: false
      } : this[kOptions]);
      const closeClientIfUnused = () => {
        if (this[_kClients].get(key) !== dispatcher) {
          return;
        }
        if (dispatcher[_kConnected] > 0 || dispatcher[_kBusy]) {
          return;
        }
        this[_kClients].delete(key);
        if (!dispatcher.destroyed) {
          dispatcher.close();
        }
        let hasOrigin = false;
        for (const client of this[_kClients].values()) {
          if (client[_kUrl].origin === dispatcher[_kUrl].origin) {
            hasOrigin = true;
            break;
          }
        }
        if (!hasOrigin) {
          this[kOrigins].delete(dispatcher[_kUrl].origin);
        }
      };
      dispatcher.on('drain', this[kOnDrain]).on('connect', this[kOnConnect]).on('disconnect', (origin, targets, err) => {
        closeClientIfUnused();
        this[kOnDisconnect](origin, targets, err);
      }).on('connectionError', (origin, targets, err) => {
        closeClientIfUnused();
        this[kOnConnectionError](origin, targets, err);
      });
      this[_kClients].set(key, dispatcher);
      this[kOrigins].add(origin);
    }
    return dispatcher.dispatch(opts, handler);
  }
  [_kClose]() {
    const closePromises = [];
    for (const dispatcher of this[_kClients].values()) {
      closePromises.push(dispatcher.close());
    }
    this[_kClients].clear();
    return Promise.all(closePromises);
  }
  [_kDestroy](err) {
    const destroyPromises = [];
    for (const dispatcher of this[_kClients].values()) {
      destroyPromises.push(dispatcher.destroy(err));
    }
    this[_kClients].clear();
    return Promise.all(destroyPromises);
  }
  get stats() {
    const allClientStats = {};
    for (const dispatcher of this[_kClients].values()) {
      if (dispatcher.stats) {
        allClientStats[dispatcher[_kUrl].origin] = dispatcher.stats;
      }
    }
    return allClientStats;
  }
}
const _cjs_default = Agent;
export default _cjs_default;
