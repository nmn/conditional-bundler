import { Log as _Log } from "./Log";
export class PendingEvents {
  constructor(batchSize) {
    this._pendingEvents = [];
    this._batchSize = batchSize;
  }
  addToPendingEventsQueue(event) {
    this._pendingEvents.push(event);
    _Log.debug('Enqueued Event:', event);
  }
  hasEventsForFullBatch() {
    return this._pendingEvents.length >= this._batchSize;
  }
  takeAll() {
    const events = this._pendingEvents;
    this._pendingEvents = [];
    return events;
  }
  isEmpty() {
    return this._pendingEvents.length === 0;
  }
}
const _cjs_default = {
  ["PendingEvents"]: PendingEvents
};
export default _cjs_default;
