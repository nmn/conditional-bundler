import $ from "../internals/export";
import call from "../internals/function-call";
import anObject from "../internals/an-object";
import getIteratorDirect from "../internals/get-iterator-direct";
import notANaN from "../internals/not-a-nan";
import toPositiveInteger from "../internals/to-positive-integer";
import createIteratorProxy from "../internals/iterator-create-proxy";
import iteratorClose from "../internals/iterator-close";
import iteratorHelperThrowsOnInvalidIterator from "../internals/iterator-helper-throws-on-invalid-iterator";
import iteratorHelperWithoutClosingOnEarlyError from "../internals/iterator-helper-without-closing-on-early-error";
import IS_PURE from "../internals/is-pure";
var TAKE_WITHOUT_THROWING_ON_INVALID_ITERATOR = !IS_PURE && !iteratorHelperThrowsOnInvalidIterator('take', 1);
var takeWithoutClosingOnEarlyError = !IS_PURE && !TAKE_WITHOUT_THROWING_ON_INVALID_ITERATOR && iteratorHelperWithoutClosingOnEarlyError('take', RangeError);
var FORCED = IS_PURE || TAKE_WITHOUT_THROWING_ON_INVALID_ITERATOR || takeWithoutClosingOnEarlyError;
var IteratorProxy = createIteratorProxy(function () {
  var iterator = this.iterator;
  if (!this.remaining--) {
    this.done = true;
    return iteratorClose(iterator, 'normal', undefined);
  }
  var result = anObject(call(this.next, iterator));
  var done = this.done = !!result.done;
  if (!done) return result.value;
});

// `Iterator.prototype.take` method
// https://tc39.es/ecma262/#sec-iterator.prototype.take
$({
  target: 'Iterator',
  proto: true,
  real: true,
  forced: FORCED
}, {
  take: function take(limit) {
    anObject(this);
    var remaining;
    try {
      remaining = toPositiveInteger(notANaN(+limit));
    } catch (error) {
      iteratorClose(this, 'throw', error);
    }
    if (takeWithoutClosingOnEarlyError) return call(takeWithoutClosingOnEarlyError, this, remaining);
    return new IteratorProxy(getIteratorDirect(this), {
      remaining: remaining
    });
  }
});
const _cjs_default = {};
export default _cjs_default;
