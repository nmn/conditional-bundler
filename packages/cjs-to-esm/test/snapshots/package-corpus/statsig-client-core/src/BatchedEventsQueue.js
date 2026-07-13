import { EventBatch as _EventBatch } from "./EventBatch";
import { EventRetryConstants as _EventRetryConstants } from "./EventRetryConstants";
export class BatchQueue {
  constructor(batchSize = _EventRetryConstants.DEFAULT_BATCH_SIZE) {
    this._batches = [];
    this._batchSize = batchSize;
  }
  batchSize() {
    return this._batchSize;
  }
  requeueBatch(batch) {
    return this._enqueueBatch(batch);
  }
  hasFullBatch() {
    return this._batches.some(batch => batch.events.length >= this._batchSize);
  }
  takeNextBatch() {
    return this._batches.shift();
  }
  takeAllBatches() {
    const batches = this._batches;
    this._batches = [];
    return batches;
  }
  createBatches(events) {
    let i = 0;
    let droppedCount = 0;
    while (i < events.length) {
      const chunk = events.slice(i, i + this._batchSize);
      droppedCount += this._enqueueBatch(new _EventBatch(chunk));
      i += this._batchSize;
    }
    return droppedCount;
  }
  _enqueueBatch(batch) {
    this._batches.push(batch);
    let droppedEventCount = 0;
    while (this._batches.length > _EventRetryConstants.MAX_PENDING_BATCHES) {
      const dropped = this._batches.shift();
      if (dropped) {
        droppedEventCount += dropped.events.length;
      }
    }
    return droppedEventCount;
  }
}
const _cjs_default = {
  ["BatchQueue"]: BatchQueue
};
export default _cjs_default;
