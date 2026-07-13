import $ from "../internals/export";
import globalThis from "../internals/global-this";
import aString from "../internals/a-string";
import anUint8Array from "../internals/an-uint8-array";
import notDetached from "../internals/array-buffer-not-detached";
import $fromHex from "../internals/uint8-from-hex";
// Should not throw an error on length-tracking views over ResizableArrayBuffer
// https://issues.chromium.org/issues/454630441
function throwsOnLengthTrackingView() {
  try {
    // eslint-disable-next-line es/no-resizable-and-growable-arraybuffers -- required for testing
    var rab = new ArrayBuffer(16, {
      maxByteLength: 1024
    });
    // eslint-disable-next-line es/no-uint8array-prototype-setfromhex, es/no-typed-arrays -- required for testing
    new Uint8Array(rab).setFromHex('cafed00d');
  } catch (error) {
    return true;
  }
}

// `Uint8Array.prototype.setFromHex` method
// https://tc39.es/ecma262/#sec-uint8array.prototype.setfromhex
if (globalThis.Uint8Array) $({
  target: 'Uint8Array',
  proto: true,
  forced: throwsOnLengthTrackingView()
}, {
  setFromHex: function setFromHex(string) {
    anUint8Array(this);
    aString(string);
    notDetached(this.buffer);
    var read = $fromHex(string, this).read;
    return {
      read: read,
      written: read / 2
    };
  }
});
const _cjs_default = {};
export default _cjs_default;
