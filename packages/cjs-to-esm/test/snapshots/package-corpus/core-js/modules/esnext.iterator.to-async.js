import $ from "../internals/export";
import anObject from "../internals/an-object";
import AsyncFromSyncIterator from "../internals/async-from-sync-iterator";
import WrapAsyncIterator from "../internals/async-iterator-wrap";
import getIteratorDirect from "../internals/get-iterator-direct";
// `Iterator.prototype.toAsync` method
// https://github.com/tc39/proposal-async-iterator-helpers
$({
  target: 'Iterator',
  proto: true,
  real: true,
  forced: true
}, {
  toAsync: function toAsync() {
    return new WrapAsyncIterator(getIteratorDirect(new AsyncFromSyncIterator(getIteratorDirect(anObject(this)))));
  }
});
const _cjs_default = {};
export default _cjs_default;
