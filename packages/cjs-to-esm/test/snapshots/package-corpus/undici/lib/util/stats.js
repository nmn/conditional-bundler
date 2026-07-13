import { kConnected as _kConnected, kPending as _kPending, kRunning as _kRunning, kSize as _kSize, kFree as _kFree, kQueued as _kQueued } from "../core/symbols";
class ClientStats {
  constructor(client) {
    this.connected = client[_kConnected];
    this.pending = client[_kPending];
    this.running = client[_kRunning];
    this.size = client[_kSize];
  }
}
class PoolStats {
  constructor(pool) {
    this.connected = pool[_kConnected];
    this.free = pool[_kFree];
    this.pending = pool[_kPending];
    this.queued = pool[_kQueued];
    this.running = pool[_kRunning];
    this.size = pool[_kSize];
  }
}
const _cjs_default = {
  ClientStats,
  PoolStats
};
const _ClientStats = _cjs_default["ClientStats"];
export { _ClientStats as ClientStats };
const _PoolStats = _cjs_default["PoolStats"];
export { _PoolStats as PoolStats };
export default _cjs_default;
