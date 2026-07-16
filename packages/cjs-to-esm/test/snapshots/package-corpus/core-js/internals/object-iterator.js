import InternalStateModule from "../internals/internal-state";
import createIteratorConstructor from "../internals/iterator-create-constructor";
import createIterResultObject from "../internals/create-iter-result-object";
import hasOwn from "../internals/has-own-property";
import objectKeys from "../internals/object-keys";
import toObject from "../internals/to-object";
var OBJECT_ITERATOR = 'Object Iterator';
var setInternalState = InternalStateModule.set;
var getInternalState = InternalStateModule.getterFor(OBJECT_ITERATOR);
const _cjs_default = createIteratorConstructor(function ObjectIterator(source, mode) {
  var object = toObject(source);
  setInternalState(this, {
    type: OBJECT_ITERATOR,
    mode: mode,
    object: object,
    keys: objectKeys(object),
    index: 0
  });
}, 'Object', function next() {
  var state = getInternalState(this);
  var keys = state.keys;
  while (true) {
    if (keys === null || state.index >= keys.length) {
      state.object = state.keys = null;
      return createIterResultObject(undefined, true);
    }
    var key = keys[state.index++];
    var object = state.object;
    if (!hasOwn(object, key)) continue;
    switch (state.mode) {
      case 'keys':
        return createIterResultObject(key, false);
      case 'values':
        return createIterResultObject(object[key], false);
    } /* entries */
    return createIterResultObject([key, object[key]], false);
  }
});
export default _cjs_default;
