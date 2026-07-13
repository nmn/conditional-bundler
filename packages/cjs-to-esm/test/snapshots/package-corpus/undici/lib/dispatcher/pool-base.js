import { PoolStats as _PoolStats } from "../util/stats.js";
import DispatcherBase from "./dispatcher-base";
import FixedQueue from "./fixed-queue";
import { kConnected as _kConnected, kSize as _kSize, kRunning as _kRunning, kPending as _kPending, kQueued as _kQueued, kBusy as _kBusy, kFree as _kFree, kUrl as _kUrl, kClose as _kClose, kDestroy as _kDestroy, kDispatch as _kDispatch } from "../core/symbols";
const kClients = Symbol('clients');
const kNeedDrain = Symbol('needDrain');
const kQueue = Symbol('queue');
const kClosedResolve = Symbol('closed resolve');
const kOnDrain = Symbol('onDrain');
const kOnConnect = Symbol('onConnect');
const kOnDisconnect = Symbol('onDisconnect');
const kOnConnectionError = Symbol('onConnectionError');
const kGetDispatcher = Symbol('get dispatcher');
const kHasDispatcher = Symbol('has dispatcher');
const kAddClient = Symbol('add client');
const kRemoveClient = Symbol('remove client');
class PoolBase extends DispatcherBase {
  [kQueue] = new FixedQueue();
  [_kQueued] = 0;
  [kClients] = [];
  [kNeedDrain] = false;
  [kOnDrain](client, origin, targets) {
    const queue = this[kQueue];
    let needDrain = false;
    while (!needDrain) {
      const item = queue.shift();
      if (!item) {
        break;
      }
      this[_kQueued]--;
      needDrain = !client.dispatch(item.opts, item.handler);
    }
    client[kNeedDrain] = needDrain;
    if (!needDrain && this[kNeedDrain]) {
      this[kNeedDrain] = false;
      this.emit('drain', origin, [this, ...targets]);
    }
    if (this[kClosedResolve] && queue.isEmpty()) {
      const closeAll = [];
      for (let i = 0; i < this[kClients].length; i++) {
        const client = this[kClients][i];
        if (!client.destroyed) {
          closeAll.push(client.close());
        }
      }
      return Promise.all(closeAll).then(this[kClosedResolve]);
    }
  }
  [kOnConnect] = (origin, targets) => {
    this.emit('connect', origin, [this, ...targets]);
  };
  [kOnDisconnect] = (origin, targets, err) => {
    this.emit('disconnect', origin, [this, ...targets], err);
  };
  [kOnConnectionError] = (origin, targets, err) => {
    this.emit('connectionError', origin, [this, ...targets], err);
  };
  get [_kBusy]() {
    return this[kNeedDrain];
  }
  get [_kConnected]() {
    let ret = 0;
    for (const {
      [_kConnected]: connected
    } of this[kClients]) {
      ret += connected;
    }
    return ret;
  }
  get [_kFree]() {
    let ret = 0;
    for (const {
      [_kConnected]: connected,
      [kNeedDrain]: needDrain
    } of this[kClients]) {
      ret += connected && !needDrain;
    }
    return ret;
  }
  get [_kPending]() {
    let ret = this[_kQueued];
    for (const {
      [_kPending]: pending
    } of this[kClients]) {
      ret += pending;
    }
    return ret;
  }
  get [_kRunning]() {
    let ret = 0;
    for (const {
      [_kRunning]: running
    } of this[kClients]) {
      ret += running;
    }
    return ret;
  }
  get [_kSize]() {
    let ret = this[_kQueued];
    for (const {
      [_kSize]: size
    } of this[kClients]) {
      ret += size;
    }
    return ret;
  }
  get stats() {
    return new _PoolStats(this);
  }
  [_kClose]() {
    if (this[kQueue].isEmpty()) {
      const closeAll = [];
      for (let i = 0; i < this[kClients].length; i++) {
        const client = this[kClients][i];
        if (!client.destroyed) {
          closeAll.push(client.close());
        }
      }
      return Promise.all(closeAll);
    } else {
      return new Promise(resolve => {
        this[kClosedResolve] = resolve;
      });
    }
  }
  [_kDestroy](err) {
    while (true) {
      const item = this[kQueue].shift();
      if (!item) {
        break;
      }
      item.handler.onResponseError(null, err);
    }
    const destroyAll = new Array(this[kClients].length);
    for (let i = 0; i < this[kClients].length; i++) {
      destroyAll[i] = this[kClients][i].destroy(err);
    }
    return Promise.all(destroyAll);
  }
  [_kDispatch](opts, handler) {
    const dispatcher = this[kGetDispatcher]();
    if (!dispatcher) {
      this[kNeedDrain] = true;
      this[kQueue].push({
        opts,
        handler
      });
      this[_kQueued]++;
    } else if (!dispatcher.dispatch(opts, handler)) {
      dispatcher[kNeedDrain] = true;
      this[kNeedDrain] = !this[kHasDispatcher]();
    }
    return !this[kNeedDrain];
  }
  [kHasDispatcher]() {
    for (let i = 0; i < this[kClients].length; i++) {
      const dispatcher = this[kClients][i];
      if (!dispatcher[kNeedDrain] && dispatcher.closed !== true && dispatcher.destroyed !== true) {
        return true;
      }
    }
    return false;
  }
  [kAddClient](client) {
    client.on('drain', this[kOnDrain].bind(this, client)).on('connect', this[kOnConnect]).on('disconnect', this[kOnDisconnect]).on('connectionError', this[kOnConnectionError]);
    this[kClients].push(client);
    if (this[kNeedDrain]) {
      queueMicrotask(() => {
        if (this[kNeedDrain]) {
          this[kOnDrain](client, client[_kUrl], [client, this]);
        }
      });
    }
    return this;
  }
  [kRemoveClient](client) {
    const idx = this[kClients].indexOf(client);
    if (idx !== -1) {
      this[kClients].splice(idx, 1);
    }
    client.close(() => {});
    this[kNeedDrain] = !this[kClients].some(dispatcher => !dispatcher[kNeedDrain] && dispatcher.closed !== true && dispatcher.destroyed !== true);
  }
}
const _cjs_default = {
  PoolBase,
  kClients,
  kNeedDrain,
  kAddClient,
  kRemoveClient,
  kGetDispatcher,
  kHasDispatcher
};
const _PoolBase = _cjs_default["PoolBase"];
export { _PoolBase as PoolBase };
const _kClients = _cjs_default["kClients"];
export { _kClients as kClients };
const _kNeedDrain = _cjs_default["kNeedDrain"];
export { _kNeedDrain as kNeedDrain };
const _kAddClient = _cjs_default["kAddClient"];
export { _kAddClient as kAddClient };
const _kRemoveClient = _cjs_default["kRemoveClient"];
export { _kRemoveClient as kRemoveClient };
const _kGetDispatcher = _cjs_default["kGetDispatcher"];
export { _kGetDispatcher as kGetDispatcher };
const _kHasDispatcher = _cjs_default["kHasDispatcher"];
export { _kHasDispatcher as kHasDispatcher };
export default _cjs_default;
