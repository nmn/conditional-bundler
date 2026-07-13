import anObject from "../internals/an-object";
import call from "../internals/function-call";
import createIteratorProxy from "../internals/iterator-create-proxy";
import createIterResultObject from "../internals/create-iter-result-object";
import getIteratorDirect from "../internals/get-iterator-direct";
import iteratorClose from "../internals/iterator-close";
import uncurryThis from "../internals/function-uncurry-this";
var $RangeError = RangeError;
var $TypeError = TypeError;
var push = uncurryThis([].push);
var slice = uncurryThis([].slice);
var ALLOW_PARTIAL = 'allow-partial';
var IteratorProxy = createIteratorProxy(function () {
  var iterator = this.iterator;
  var next = this.next;
  var buffer = this.buffer;
  var windowSize = this.windowSize;
  var allowPartial = this.allowPartial;
  var result, done;
  while (true) {
    result = anObject(call(next, iterator));
    done = this.done = !!result.done;
    if (allowPartial && done && buffer.length && buffer.length < windowSize) return createIterResultObject(slice(buffer, 0), false);
    if (done) return createIterResultObject(undefined, true);
    if (buffer.length === windowSize) this.buffer = buffer = slice(buffer, 1);
    push(buffer, result.value);
    if (buffer.length === windowSize) return createIterResultObject(slice(buffer, 0), false);
  }
}, false, true);

// `Iterator.prototype.windows` and obsolete `Iterator.prototype.sliding` methods
// https://github.com/tc39/proposal-iterator-chunking
const _cjs_default = function (O, windowSize, undersized) {
  anObject(O);
  if (typeof windowSize != 'number' || !windowSize || windowSize >>> 0 !== windowSize) {
    return iteratorClose(O, 'throw', new $RangeError('`windowSize` must be integer in [1, 2^32-1]'));
  }
  if (undersized !== undefined && undersized !== 'only-full' && undersized !== ALLOW_PARTIAL) {
    return iteratorClose(O, 'throw', new $TypeError('Incorrect `undersized` argument'));
  }
  return new IteratorProxy(getIteratorDirect(O), {
    windowSize: windowSize,
    buffer: [],
    allowPartial: undersized === ALLOW_PARTIAL
  });
};
export default _cjs_default;
