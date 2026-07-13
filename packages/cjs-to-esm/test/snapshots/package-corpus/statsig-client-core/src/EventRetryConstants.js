const _EventRetryConstants = {
  MAX_RETRY_ATTEMPTS: 8,
  DEFAULT_BATCH_SIZE: 100,
  MAX_PENDING_BATCHES: 40,
  TICK_INTERVAL_MS: 1000,
  QUICK_FLUSH_WINDOW_MS: 200,
  MAX_LOCAL_STORAGE: 500,
  get MAX_QUEUED_EVENTS() {
    return this.DEFAULT_BATCH_SIZE * this.MAX_PENDING_BATCHES;
  }
};
export { _EventRetryConstants as EventRetryConstants };
const _cjs_default = {
  ["EventRetryConstants"]: _EventRetryConstants
};
export default _cjs_default;
