import $ from "../internals/export";
import call from "../internals/function-call";
import aCallable from "../internals/a-callable";
import anObject from "../internals/an-object";
import getIteratorDirect from "../internals/get-iterator-direct";
import createIteratorProxy from "../internals/iterator-create-proxy";
import callWithSafeIterationClosing from "../internals/call-with-safe-iteration-closing";
import iteratorClose from "../internals/iterator-close";
import iteratorHelperThrowsOnInvalidIterator from "../internals/iterator-helper-throws-on-invalid-iterator";
import iteratorHelperWithoutClosingOnEarlyError from "../internals/iterator-helper-without-closing-on-early-error";
import IS_PURE from "../internals/is-pure";
var MAP_WITHOUT_THROWING_ON_INVALID_ITERATOR = !IS_PURE && !iteratorHelperThrowsOnInvalidIterator('map', function () {/* empty */});
var mapWithoutClosingOnEarlyError = !IS_PURE && !MAP_WITHOUT_THROWING_ON_INVALID_ITERATOR && iteratorHelperWithoutClosingOnEarlyError('map', TypeError);
var FORCED = IS_PURE || MAP_WITHOUT_THROWING_ON_INVALID_ITERATOR || mapWithoutClosingOnEarlyError;
var IteratorProxy = createIteratorProxy(function () {
  var iterator = this.iterator;
  var result = anObject(call(this.next, iterator));
  var done = this.done = !!result.done;
  if (!done) return callWithSafeIterationClosing(iterator, this.mapper, [result.value, this.counter++], true);
});

// `Iterator.prototype.map` method
// https://tc39.es/ecma262/#sec-iterator.prototype.map
$({
  target: 'Iterator',
  proto: true,
  real: true,
  forced: FORCED
}, {
  map: function map(mapper) {
    anObject(this);
    try {
      aCallable(mapper);
    } catch (error) {
      iteratorClose(this, 'throw', error);
    }
    if (mapWithoutClosingOnEarlyError) return call(mapWithoutClosingOnEarlyError, this, mapper);
    return new IteratorProxy(getIteratorDirect(this), {
      mapper: mapper
    });
  }
});
const _cjs_default = {};
export default _cjs_default;
