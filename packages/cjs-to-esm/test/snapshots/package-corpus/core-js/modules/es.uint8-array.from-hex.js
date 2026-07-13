import $ from "../internals/export";
import globalThis from "../internals/global-this";
import aString from "../internals/a-string";
import $fromHex from "../internals/uint8-from-hex";
// `Uint8Array.fromHex` method
// https://tc39.es/ecma262/#sec-uint8array.fromhex
if (globalThis.Uint8Array) $({
  target: 'Uint8Array',
  stat: true
}, {
  fromHex: function fromHex(string) {
    return $fromHex(aString(string)).bytes;
  }
});
const _cjs_default = {};
export default _cjs_default;
