import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this-clause";
import fails from "../internals/fails";
import { ArrayBuffer as _ArrayBuffer, DataView as _DataView } from "../internals/array-buffer";
import anObject from "../internals/an-object";
import toAbsoluteIndex from "../internals/to-absolute-index";
import toLength from "../internals/to-length";
var ArrayBuffer = _ArrayBuffer;
var DataView = _DataView;
var DataViewPrototype = DataView.prototype;
var nativeArrayBufferSlice = uncurryThis(ArrayBuffer.prototype.slice);
var getUint8 = uncurryThis(DataViewPrototype.getUint8);
var setUint8 = uncurryThis(DataViewPrototype.setUint8);
var INCORRECT_SLICE = fails(function () {
  return !new ArrayBuffer(2).slice(1, undefined).byteLength;
});

// `ArrayBuffer.prototype.slice` method
// https://tc39.es/ecma262/#sec-arraybuffer.prototype.slice
$({
  target: 'ArrayBuffer',
  proto: true,
  unsafe: true,
  forced: INCORRECT_SLICE
}, {
  slice: function slice(start, end) {
    if (nativeArrayBufferSlice && end === undefined) {
      return nativeArrayBufferSlice(anObject(this), start); // FF fix
    }
    var length = anObject(this).byteLength;
    var first = toAbsoluteIndex(start, length);
    var fin = toAbsoluteIndex(end === undefined ? length : end, length);
    var result = new ArrayBuffer(toLength(fin - first));
    var viewSource = new DataView(this);
    var viewTarget = new DataView(result);
    var index = 0;
    while (first < fin) {
      setUint8(viewTarget, index++, getUint8(viewSource, first++));
    }
    return result;
  }
});
const _cjs_default = {};
export default _cjs_default;
