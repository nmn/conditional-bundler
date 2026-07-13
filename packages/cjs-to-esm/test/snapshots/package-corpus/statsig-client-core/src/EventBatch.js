export class EventBatch {
  constructor(events) {
    this.attempts = 0;
    this.createdAt = Date.now();
    this.events = events;
  }
  incrementAttempts() {
    this.attempts++;
  }
}
const _cjs_default = {
  ["EventBatch"]: EventBatch
};
export default _cjs_default;
