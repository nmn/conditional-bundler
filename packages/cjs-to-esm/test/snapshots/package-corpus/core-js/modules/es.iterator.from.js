import $ from "../internals/export";
import call from "../internals/function-call";
import toObject from "../internals/to-object";
import isPrototypeOf from "../internals/object-is-prototype-of";
import { IteratorPrototype as _IteratorPrototype } from "../internals/iterators-core";
import createIteratorProxy from "../internals/iterator-create-proxy";
import getIteratorFlattenable from "../internals/get-iterator-flattenable";
import IS_PURE from "../internals/is-pure";
var IteratorPrototype = _IteratorPrototype;
var FORCED = IS_PURE || function () {
  // Should not throw when an underlying iterator's `return` method is null
  // https://bugs.webkit.org/show_bug.cgi?id=288714
  try {
    // eslint-disable-next-line es/no-iterator -- required for testing
    Iterator.from({
      'return': null
    })['return']();
  } catch (error) {
    return true;
  }
}();
var IteratorProxy = createIteratorProxy(function () {
  return call(this.next, this.iterator);
}, true);

// `Iterator.from` method
// https://tc39.es/ecma262/#sec-iterator.from
$({
  target: 'Iterator',
  stat: true,
  forced: FORCED
}, {
  from: function from(O) {
    var iteratorRecord = getIteratorFlattenable(typeof O == 'string' ? toObject(O) : O, true);
    return isPrototypeOf(IteratorPrototype, iteratorRecord.iterator) ? iteratorRecord.iterator : new IteratorProxy(iteratorRecord);
  }
});
const _cjs_default = {};
export default _cjs_default;
