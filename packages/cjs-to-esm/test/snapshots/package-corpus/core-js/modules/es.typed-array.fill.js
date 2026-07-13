import { aTypedArray as _aTypedArray, exportTypedArrayMethod as _exportTypedArrayMethod } from "../internals/array-buffer-view-core";
import $fill from "../internals/array-fill";
import toBigInt from "../internals/to-big-int";
import classof from "../internals/classof";
import call from "../internals/function-call";
import uncurryThis from "../internals/function-uncurry-this";
import fails from "../internals/fails";
var aTypedArray = _aTypedArray;
var exportTypedArrayMethod = _exportTypedArrayMethod;
var slice = uncurryThis(''.slice);

// V8 ~ Chrome < 59, Safari < 14.1, FF < 55, Edge <=18
var CONVERSION_BUG = fails(function () {
  var count = 0;
  // eslint-disable-next-line es/no-typed-arrays -- safe
  new Int8Array(2).fill({
    valueOf: function () {
      return count++;
    }
  });
  return count !== 1;
});

// `%TypedArray%.prototype.fill` method
// https://tc39.es/ecma262/#sec-%typedarray%.prototype.fill
exportTypedArrayMethod('fill', function fill(value /* , start, end */) {
  var length = arguments.length;
  aTypedArray(this);
  var actualValue = slice(classof(this), 0, 3) === 'Big' ? toBigInt(value) : +value;
  return call($fill, this, actualValue, length > 1 ? arguments[1] : undefined, length > 2 ? arguments[2] : undefined);
}, CONVERSION_BUG);
const _cjs_default = {};
export default _cjs_default;
