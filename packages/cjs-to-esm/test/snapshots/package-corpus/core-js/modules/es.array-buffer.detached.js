import DESCRIPTORS from "../internals/descriptors";
import defineBuiltInAccessor from "../internals/define-built-in-accessor";
import isDetached from "../internals/array-buffer-is-detached";
var ArrayBufferPrototype = ArrayBuffer.prototype;

// `ArrayBuffer.prototype.detached` getter
// https://tc39.es/ecma262/#sec-get-arraybuffer.prototype.detached
if (DESCRIPTORS && !('detached' in ArrayBufferPrototype)) {
  defineBuiltInAccessor(ArrayBufferPrototype, 'detached', {
    configurable: true,
    get: function detached() {
      return isDetached(this);
    }
  });
}
const _cjs_default = {};
export default _cjs_default;
