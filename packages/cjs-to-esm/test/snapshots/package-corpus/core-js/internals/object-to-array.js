import DESCRIPTORS from "../internals/descriptors";
import fails from "../internals/fails";
import uncurryThis from "../internals/function-uncurry-this";
import objectGetPrototypeOf from "../internals/object-get-prototype-of";
import objectKeys from "../internals/object-keys";
import toIndexedObject from "../internals/to-indexed-object";
import _cjs_import from "../internals/object-property-is-enumerable";
var $propertyIsEnumerable = _cjs_import.f;
var propertyIsEnumerable = uncurryThis($propertyIsEnumerable);
var push = uncurryThis([].push);

// in some IE versions, `propertyIsEnumerable` returns incorrect result on integer keys
// of `null` prototype objects
var IE_BUG = DESCRIPTORS && fails(function () {
  // eslint-disable-next-line es/no-object-create -- safe
  var O = Object.create(null);
  O[2] = 2;
  return !propertyIsEnumerable(O, 2);
});

// `Object.{ entries, values }` methods implementation
var createMethod = function (TO_ENTRIES) {
  return function (it) {
    var O = toIndexedObject(it);
    var keys = objectKeys(O);
    var IE_WORKAROUND = IE_BUG && objectGetPrototypeOf(O) === null;
    var length = keys.length;
    var i = 0;
    var result = [];
    var key;
    while (length > i) {
      key = keys[i++];
      if (!DESCRIPTORS || (IE_WORKAROUND ? key in O : propertyIsEnumerable(O, key))) {
        push(result, TO_ENTRIES ? [key, O[key]] : O[key]);
      }
    }
    return result;
  };
};
const _cjs_default = {
  // `Object.entries` method
  // https://tc39.es/ecma262/#sec-object.entries
  entries: createMethod(true),
  // `Object.values` method
  // https://tc39.es/ecma262/#sec-object.values
  values: createMethod(false)
};
const _entries = _cjs_default["entries"];
export { _entries as entries };
const _values = _cjs_default["values"];
export { _values as values };
export default _cjs_default;
