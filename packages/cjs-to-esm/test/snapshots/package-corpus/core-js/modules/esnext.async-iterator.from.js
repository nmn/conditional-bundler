import $ from "../internals/export";
import toObject from "../internals/to-object";
import isPrototypeOf from "../internals/object-is-prototype-of";
import getAsyncIteratorFlattenable from "../internals/get-async-iterator-flattenable";
import AsyncIteratorPrototype from "../internals/async-iterator-prototype";
import WrapAsyncIterator from "../internals/async-iterator-wrap";
// `AsyncIterator.from` method
// https://github.com/tc39/proposal-async-iterator-helpers
$({
  target: 'AsyncIterator',
  stat: true,
  forced: true
}, {
  from: function from(O) {
    var iteratorRecord = getAsyncIteratorFlattenable(typeof O == 'string' ? toObject(O) : O);
    return isPrototypeOf(AsyncIteratorPrototype, iteratorRecord.iterator) ? iteratorRecord.iterator : new WrapAsyncIterator(iteratorRecord);
  }
});
const _cjs_default = {};
export default _cjs_default;
