import $ from "../internals/export";
import call from "../internals/function-call";
import iterate from "../internals/iterate";
import aCallable from "../internals/a-callable";
import anObject from "../internals/an-object";
import getIteratorDirect from "../internals/get-iterator-direct";
import iteratorClose from "../internals/iterator-close";
import iteratorHelperWithoutClosingOnEarlyError from "../internals/iterator-helper-without-closing-on-early-error";
var forEachWithoutClosingOnEarlyError = iteratorHelperWithoutClosingOnEarlyError('forEach', TypeError);

// `Iterator.prototype.forEach` method
// https://tc39.es/ecma262/#sec-iterator.prototype.foreach
$({
  target: 'Iterator',
  proto: true,
  real: true,
  forced: forEachWithoutClosingOnEarlyError
}, {
  forEach: function forEach(fn) {
    anObject(this);
    try {
      aCallable(fn);
    } catch (error) {
      iteratorClose(this, 'throw', error);
    }
    if (forEachWithoutClosingOnEarlyError) return call(forEachWithoutClosingOnEarlyError, this, fn);
    var record = getIteratorDirect(this);
    var counter = 0;
    iterate(record, function (value) {
      fn(value, counter++);
    }, {
      IS_RECORD: true
    });
  }
});
const _cjs_default = {};
export default _cjs_default;
