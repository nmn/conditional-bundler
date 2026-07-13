import $ from "../internals/export";
import call from "../internals/function-call";
import aCallable from "../internals/a-callable";
import anObject from "../internals/an-object";
import getIteratorMethod from "../internals/get-iterator-method";
import createIteratorProxy from "../internals/iterator-create-proxy";
import IS_PURE from "../internals/is-pure";
var $Array = Array;
var IteratorProxy = createIteratorProxy(function () {
  while (true) {
    var iterator = this.iterator;
    if (!iterator) {
      var iterableIndex = this.nextIterableIndex++;
      var iterables = this.iterables;
      if (iterableIndex >= iterables.length) {
        this.done = true;
        return;
      }
      var entry = iterables[iterableIndex];
      this.iterables[iterableIndex] = null;
      iterator = this.iterator = anObject(call(entry.method, entry.iterable));
      this.next = iterator.next;
    }
    var result = anObject(call(this.next, iterator));
    if (result.done) {
      this.iterator = null;
      this.next = null;
      continue;
    }
    return result.value;
  }
});

// `Iterator.concat` method
// https://tc39.es/ecma262/#sec-iterator.concat
$({
  target: 'Iterator',
  stat: true,
  forced: IS_PURE
}, {
  concat: function concat() {
    var length = arguments.length;
    var iterables = $Array(length);
    for (var index = 0; index < length; index++) {
      var item = anObject(arguments[index]);
      iterables[index] = {
        iterable: item,
        method: aCallable(getIteratorMethod(item))
      };
    }
    return new IteratorProxy({
      iterables: iterables,
      nextIterableIndex: 0,
      iterator: null,
      next: null
    });
  }
});
const _cjs_default = {};
export default _cjs_default;
