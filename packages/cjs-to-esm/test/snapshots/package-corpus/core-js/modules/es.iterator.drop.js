import $ from "../internals/export";
import call from "../internals/function-call";
import anObject from "../internals/an-object";
import getIteratorDirect from "../internals/get-iterator-direct";
import notANaN from "../internals/not-a-nan";
import toPositiveInteger from "../internals/to-positive-integer";
import iteratorClose from "../internals/iterator-close";
import createIteratorProxy from "../internals/iterator-create-proxy";
import iteratorHelperThrowsOnInvalidIterator from "../internals/iterator-helper-throws-on-invalid-iterator";
import iteratorHelperWithoutClosingOnEarlyError from "../internals/iterator-helper-without-closing-on-early-error";
import IS_PURE from "../internals/is-pure";
var DROP_WITHOUT_THROWING_ON_INVALID_ITERATOR = !IS_PURE && !iteratorHelperThrowsOnInvalidIterator('drop', 0);
var dropWithoutClosingOnEarlyError = !IS_PURE && !DROP_WITHOUT_THROWING_ON_INVALID_ITERATOR && iteratorHelperWithoutClosingOnEarlyError('drop', RangeError);
var FORCED = IS_PURE || DROP_WITHOUT_THROWING_ON_INVALID_ITERATOR || dropWithoutClosingOnEarlyError;
var IteratorProxy = createIteratorProxy(function () {
  var iterator = this.iterator;
  var next = this.next;
  var result, done;
  while (this.remaining) {
    this.remaining--;
    result = anObject(call(next, iterator));
    done = this.done = !!result.done;
    if (done) return;
  }
  result = anObject(call(next, iterator));
  done = this.done = !!result.done;
  if (!done) return result.value;
});

// `Iterator.prototype.drop` method
// https://tc39.es/ecma262/#sec-iterator.prototype.drop
$({
  target: 'Iterator',
  proto: true,
  real: true,
  forced: FORCED
}, {
  drop: function drop(limit) {
    anObject(this);
    var remaining;
    try {
      remaining = toPositiveInteger(notANaN(+limit));
    } catch (error) {
      iteratorClose(this, 'throw', error);
    }
    if (dropWithoutClosingOnEarlyError) return call(dropWithoutClosingOnEarlyError, this, remaining);
    return new IteratorProxy(getIteratorDirect(this), {
      remaining: remaining
    });
  }
});
const _cjs_default = {};
export default _cjs_default;
