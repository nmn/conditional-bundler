import globalThis from "../internals/global-this";
import fails from "../internals/fails";
import V8 from "../internals/environment-v8-version";
import ENVIRONMENT from "../internals/environment";
var structuredClone = globalThis.structuredClone;
const _cjs_default = !!structuredClone && !fails(function () {
  // prevent V8 ArrayBufferDetaching protector cell invalidation and performance degradation
  // https://github.com/zloirock/core-js/issues/679
  if (ENVIRONMENT === 'DENO' && V8 > 92 || ENVIRONMENT === 'NODE' && V8 > 94 || ENVIRONMENT === 'BROWSER' && V8 > 97) return false;
  var buffer = new ArrayBuffer(8);
  var clone = structuredClone(buffer, {
    transfer: [buffer]
  });
  return buffer.byteLength !== 0 || clone.byteLength !== 8;
});
export default _cjs_default;
