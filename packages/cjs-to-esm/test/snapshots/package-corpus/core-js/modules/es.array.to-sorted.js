import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this";
import aCallable from "../internals/a-callable";
import toIndexedObject from "../internals/to-indexed-object";
import arrayFromConstructorAndList from "../internals/array-from-constructor-and-list";
import getBuiltInPrototypeMethod from "../internals/get-built-in-prototype-method";
import addToUnscopables from "../internals/add-to-unscopables";
var $Array = Array;
var sort = uncurryThis(getBuiltInPrototypeMethod('Array', 'sort'));

// `Array.prototype.toSorted` method
// https://tc39.es/ecma262/#sec-array.prototype.tosorted
$({
  target: 'Array',
  proto: true
}, {
  toSorted: function toSorted(compareFn) {
    if (compareFn !== undefined) aCallable(compareFn);
    var O = toIndexedObject(this);
    var A = arrayFromConstructorAndList($Array, O);
    return sort(A, compareFn);
  }
});
addToUnscopables('toSorted');
const _cjs_default = {};
export default _cjs_default;
