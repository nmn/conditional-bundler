import $ from "../internals/export";
import globalThis from "../internals/global-this";
import arrayFromConstructorAndList from "../internals/array-from-constructor-and-list";
import $fromBase64 from "../internals/uint8-from-base64";
var Uint8Array = globalThis.Uint8Array;
var INCORRECT_BEHAVIOR_OR_DOESNT_EXISTS = !Uint8Array || !Uint8Array.fromBase64 || !function () {
  // Webkit not throw an error on odd length string
  try {
    Uint8Array.fromBase64('a');
    return;
  } catch (error) {/* empty */}
  try {
    Uint8Array.fromBase64('', null);
  } catch (error) {
    return true;
  }
}();

// `Uint8Array.fromBase64` method
// https://tc39.es/ecma262/#sec-uint8array.frombase64
if (Uint8Array) $({
  target: 'Uint8Array',
  stat: true,
  forced: INCORRECT_BEHAVIOR_OR_DOESNT_EXISTS
}, {
  fromBase64: function fromBase64(string /* , options */) {
    var result = $fromBase64(string, arguments.length > 1 ? arguments[1] : undefined, null, 0x1FFFFFFFFFFFFF);
    return arrayFromConstructorAndList(Uint8Array, result.bytes);
  }
});
const _cjs_default = {};
export default _cjs_default;
