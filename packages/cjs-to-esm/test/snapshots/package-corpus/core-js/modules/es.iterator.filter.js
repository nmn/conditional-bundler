import $ from "../internals/export";
import call from "../internals/function-call";
import aCallable from "../internals/a-callable";
import anObject from "../internals/an-object";
import getIteratorDirect from "../internals/get-iterator-direct";
import createIteratorProxy from "../internals/iterator-create-proxy";
import callWithSafeIterationClosing from "../internals/call-with-safe-iteration-closing";
import IS_PURE from "../internals/is-pure";
import iteratorClose from "../internals/iterator-close";
import iteratorHelperThrowsOnInvalidIterator from "../internals/iterator-helper-throws-on-invalid-iterator";
import iteratorHelperWithoutClosingOnEarlyError from "../internals/iterator-helper-without-closing-on-early-error";
var FILTER_WITHOUT_THROWING_ON_INVALID_ITERATOR = !IS_PURE && !iteratorHelperThrowsOnInvalidIterator('filter', function () {/* empty */});
var filterWithoutClosingOnEarlyError = !IS_PURE && !FILTER_WITHOUT_THROWING_ON_INVALID_ITERATOR && iteratorHelperWithoutClosingOnEarlyError('filter', TypeError);
var FORCED = IS_PURE || FILTER_WITHOUT_THROWING_ON_INVALID_ITERATOR || filterWithoutClosingOnEarlyError;
var IteratorProxy = createIteratorProxy(function () {
  var iterator = this.iterator;
  var predicate = this.predicate;
  var next = this.next;
  var result, done, value;
  while (true) {
    result = anObject(call(next, iterator));
    done = this.done = !!result.done;
    if (done) return;
    value = result.value;
    if (callWithSafeIterationClosing(iterator, predicate, [value, this.counter++], true)) return value;
  }
});

// `Iterator.prototype.filter` method
// https://tc39.es/ecma262/#sec-iterator.prototype.filter
$({
  target: 'Iterator',
  proto: true,
  real: true,
  forced: FORCED
}, {
  filter: function filter(predicate) {
    anObject(this);
    try {
      aCallable(predicate);
    } catch (error) {
      iteratorClose(this, 'throw', error);
    }
    if (filterWithoutClosingOnEarlyError) return call(filterWithoutClosingOnEarlyError, this, predicate);
    return new IteratorProxy(getIteratorDirect(this), {
      predicate: predicate
    });
  }
});
const _cjs_default = {};
export default _cjs_default;
