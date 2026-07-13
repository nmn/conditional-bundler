import { IteratorPrototype as _IteratorPrototype } from "../internals/iterators-core";
import create from "../internals/object-create";
import createPropertyDescriptor from "../internals/create-property-descriptor";
import setToStringTag from "../internals/set-to-string-tag";
import Iterators from "../internals/iterators";
var IteratorPrototype = _IteratorPrototype;
var returnThis = function () {
  return this;
};
const _cjs_default = function (IteratorConstructor, NAME, next, ENUMERABLE_NEXT) {
  var TO_STRING_TAG = NAME + ' Iterator';
  IteratorConstructor.prototype = create(IteratorPrototype, {
    next: createPropertyDescriptor(+!ENUMERABLE_NEXT, next)
  });
  setToStringTag(IteratorConstructor, TO_STRING_TAG, false, true);
  Iterators[TO_STRING_TAG] = returnThis;
  return IteratorConstructor;
};
export default _cjs_default;
