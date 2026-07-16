import _cjs_import from "../core/symbols";
const {
  kConnected,
  kPending,
  kRunning,
  kSize,
  kFree,
  kQueued
} = _cjs_import;
class ClientStats {
  constructor(client) {
    this.connected = client[kConnected];
    this.pending = client[kPending];
    this.running = client[kRunning];
    this.size = client[kSize];
  }
}
class PoolStats {
  constructor(pool) {
    this.connected = pool[kConnected];
    this.free = pool[kFree];
    this.pending = pool[kPending];
    this.queued = pool[kQueued];
    this.running = pool[kRunning];
    this.size = pool[kSize];
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
