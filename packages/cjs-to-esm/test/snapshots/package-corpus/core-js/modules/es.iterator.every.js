import $ from "../internals/export";
import call from "../internals/function-call";
import iterate from "../internals/iterate";
import aCallable from "../internals/a-callable";
import anObject from "../internals/an-object";
import getIteratorDirect from "../internals/get-iterator-direct";
import iteratorClose from "../internals/iterator-close";
import iteratorHelperWithoutClosingOnEarlyError from "../internals/iterator-helper-without-closing-on-early-error";
var everyWithoutClosingOnEarlyError = iteratorHelperWithoutClosingOnEarlyError('every', TypeError);

// `Iterator.prototype.every` method
// https://tc39.es/ecma262/#sec-iterator.prototype.every
$({
  target: 'Iterator',
  proto: true,
  real: true,
  forced: everyWithoutClosingOnEarlyError
}, {
  every: function every(predicate) {
    anObject(this);
    try {
      aCallable(predicate);
    } catch (error) {
      iteratorClose(this, 'throw', error);
    }
    if (everyWithoutClosingOnEarlyError) return call(everyWithoutClosingOnEarlyError, this, predicate);
    var record = getIteratorDirect(this);
    var counter = 0;
    return !iterate(record, function (value, stop) {
      if (!predicate(value, counter++)) return stop();
    }, {
      IS_RECORD: true,
      INTERRUPTED: true
    }).stopped;
  }
});
const _cjs_default = {};
export default _cjs_default;
