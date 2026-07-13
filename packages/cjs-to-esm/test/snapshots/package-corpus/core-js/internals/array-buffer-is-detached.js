import globalThis from "../internals/global-this";
import NATIVE_ARRAY_BUFFER from "../internals/array-buffer-basic-detection";
import arrayBufferByteLength from "../internals/array-buffer-byte-length";
var DataView = globalThis.DataView;
const _cjs_default = function (O) {
  if (!NATIVE_ARRAY_BUFFER || arrayBufferByteLength(O) !== 0) return false;
  try {
    // eslint-disable-next-line no-new -- thrower
    new DataView(O);
    return false;
  } catch (error) {
    return true;
  }
};
export default _cjs_default;
