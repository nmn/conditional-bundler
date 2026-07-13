import $ from "../internals/export";
import anObject from "../internals/an-object";
import call from "../internals/function-call";
import createIteratorProxy from "../internals/iterator-create-proxy";
import getIteratorDirect from "../internals/get-iterator-direct";
import iteratorClose from "../internals/iterator-close";
import uncurryThis from "../internals/function-uncurry-this";
var $RangeError = RangeError;
var push = uncurryThis([].push);
var IteratorProxy = createIteratorProxy(function () {
  var iterator = this.iterator;
  var next = this.next;
  var chunkSize = this.chunkSize;
  var buffer = [];
  var result, done;
  while (true) {
    result = anObject(call(next, iterator));
    done = !!result.done;
    if (done) {
      if (buffer.length) return buffer;
      this.done = true;
      return;
    }
    push(buffer, result.value);
    if (buffer.length === chunkSize) return buffer;
  }
});

// `Iterator.prototype.chunks` method
// https://github.com/tc39/proposal-iterator-chunking
$({
  target: 'Iterator',
  proto: true,
  real: true,
  forced: true
}, {
  chunks: function chunks(chunkSize) {
    var O = anObject(this);
    if (typeof chunkSize != 'number' || !chunkSize || chunkSize >>> 0 !== chunkSize) {
      return iteratorClose(O, 'throw', new $RangeError('chunkSize must be integer in [1, 2^32-1]'));
    }
    return new IteratorProxy(getIteratorDirect(O), {
      chunkSize: chunkSize
    });
  }
});
const _cjs_default = {};
export default _cjs_default;
