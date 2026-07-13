import bind from "../internals/function-bind-context";
import uncurryThis from "../internals/function-uncurry-this";
import IndexedObject from "../internals/indexed-object";
import toObject from "../internals/to-object";
import toPropertyKey from "../internals/to-property-key";
import lengthOfArrayLike from "../internals/length-of-array-like";
import objectCreate from "../internals/object-create";
import arrayFromConstructorAndList from "../internals/array-from-constructor-and-list";
var $Array = Array;
var push = uncurryThis([].push);
const _cjs_default = function ($this, callbackfn, that, specificConstructor) {
  var O = toObject($this);
  var self = IndexedObject(O);
  var boundFunction = bind(callbackfn, that);
  var target = objectCreate(null);
  var length = lengthOfArrayLike(self);
  var index = 0;
  var Constructor, key, value;
  for (; length > index; index++) {
    value = self[index];
    key = toPropertyKey(boundFunction(value, index, O));
    // in some IE versions, `hasOwnProperty` returns incorrect result on integer keys
    // but since it's a `null` prototype object, we can safely use `in`
    if (key in target) push(target[key], value);else target[key] = [value];
  }
  // TODO: Remove this block from `core-js@4`
  if (specificConstructor) {
    Constructor = specificConstructor(O);
    if (Constructor !== $Array) {
      for (key in target) target[key] = arrayFromConstructorAndList(Constructor, target[key]);
    }
  }
  return target;
};
export default _cjs_default;
