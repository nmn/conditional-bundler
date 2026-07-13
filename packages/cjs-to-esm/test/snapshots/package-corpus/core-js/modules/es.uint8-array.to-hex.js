import $ from "../internals/export";
import globalThis from "../internals/global-this";
import uncurryThis from "../internals/function-uncurry-this";
import anUint8Array from "../internals/an-uint8-array";
import notDetached from "../internals/array-buffer-not-detached";
var numberToString = uncurryThis(1.1.toString);
var join = uncurryThis([].join);
var $Array = Array;
var Uint8Array = globalThis.Uint8Array;
var INCORRECT_BEHAVIOR_OR_DOESNT_EXISTS = !Uint8Array || !Uint8Array.prototype.toHex || !function () {
  try {
    var target = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255]);
    return target.toHex() === 'ffffffffffffffff';
  } catch (error) {
    return false;
  }
}();

// `Uint8Array.prototype.toHex` method
// https://tc39.es/ecma262/#sec-uint8array.prototype.tohex
if (Uint8Array) $({
  target: 'Uint8Array',
  proto: true,
  forced: INCORRECT_BEHAVIOR_OR_DOESNT_EXISTS
}, {
  toHex: function toHex() {
    anUint8Array(this);
    notDetached(this.buffer);
    var result = $Array(this.length);
    for (var i = 0, length = this.length; i < length; i++) {
      var hex = numberToString(this[i], 16);
      result[i] = hex.length === 1 ? '0' + hex : hex;
    }
    return join(result, '');
  }
});
const _cjs_default = {};
export default _cjs_default;
