import globalThis from "../internals/global-this";
import uncurryThis from "../internals/function-uncurry-this";
import uncurryThisAccessor from "../internals/function-uncurry-this-accessor";
import toIndex from "../internals/to-index";
import notDetached from "../internals/array-buffer-not-detached";
import arrayBufferByteLength from "../internals/array-buffer-byte-length";
import detachTransferable from "../internals/detach-transferable";
import PROPER_STRUCTURED_CLONE_TRANSFER from "../internals/structured-clone-proper-transfer";
var structuredClone = globalThis.structuredClone;
var ArrayBuffer = globalThis.ArrayBuffer;
var DataView = globalThis.DataView;
var max = Math.max;
var min = Math.min;
var ArrayBufferPrototype = ArrayBuffer.prototype;
var DataViewPrototype = DataView.prototype;
var slice = uncurryThis(ArrayBufferPrototype.slice);
var isResizable = uncurryThisAccessor(ArrayBufferPrototype, 'resizable', 'get');
var maxByteLength = uncurryThisAccessor(ArrayBufferPrototype, 'maxByteLength', 'get');
var getInt8 = uncurryThis(DataViewPrototype.getInt8);
var setInt8 = uncurryThis(DataViewPrototype.setInt8);
const _cjs_default = (PROPER_STRUCTURED_CLONE_TRANSFER || detachTransferable) && function (arrayBuffer, newLength, preserveResizability) {
  var byteLength = arrayBufferByteLength(arrayBuffer);
  var newByteLength = newLength === undefined ? byteLength : toIndex(newLength);
  var fixedLength = !isResizable || !isResizable(arrayBuffer);
  var newBuffer;
  notDetached(arrayBuffer);
  if (PROPER_STRUCTURED_CLONE_TRANSFER) {
    arrayBuffer = structuredClone(arrayBuffer, {
      transfer: [arrayBuffer]
    });
    if (byteLength === newByteLength && (preserveResizability || fixedLength)) return arrayBuffer;
  }
  if (byteLength >= newByteLength && (!preserveResizability || fixedLength)) {
    newBuffer = slice(arrayBuffer, 0, newByteLength);
  } else {
    var options = preserveResizability && !fixedLength && maxByteLength ? {
      maxByteLength: max(newByteLength, maxByteLength(arrayBuffer))
    } : undefined;
    newBuffer = new ArrayBuffer(newByteLength, options);
    var a = new DataView(arrayBuffer);
    var b = new DataView(newBuffer);
    var copyLength = min(newByteLength, byteLength);
    for (var i = 0; i < copyLength; i++) setInt8(b, i, getInt8(a, i));
  }
  if (!PROPER_STRUCTURED_CLONE_TRANSFER) detachTransferable(arrayBuffer);
  return newBuffer;
};
export default _cjs_default;
