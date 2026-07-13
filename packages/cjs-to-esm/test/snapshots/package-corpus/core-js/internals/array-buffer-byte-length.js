import globalThis from "../internals/global-this";
import uncurryThisAccessor from "../internals/function-uncurry-this-accessor";
import classof from "../internals/classof-raw";
var ArrayBuffer = globalThis.ArrayBuffer;
var TypeError = globalThis.TypeError;

// Includes
// - Perform ? RequireInternalSlot(O, [[ArrayBufferData]]).
// - If IsSharedArrayBuffer(O) is true, throw a TypeError exception.
const _cjs_default = ArrayBuffer && uncurryThisAccessor(ArrayBuffer.prototype, 'byteLength', 'get') || function (O) {
  if (classof(O) !== 'ArrayBuffer') throw new TypeError('ArrayBuffer expected');
  return O.byteLength;
};
export default _cjs_default;
