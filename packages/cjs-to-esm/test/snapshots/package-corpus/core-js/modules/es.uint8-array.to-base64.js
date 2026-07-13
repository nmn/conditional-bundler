import $ from "../internals/export";
import globalThis from "../internals/global-this";
import uncurryThis from "../internals/function-uncurry-this";
import anObjectOrUndefined from "../internals/an-object-or-undefined";
import anUint8Array from "../internals/an-uint8-array";
import notDetached from "../internals/array-buffer-not-detached";
import { i2c as _i2c, i2cUrl as _i2cUrl } from "../internals/base64-map";
import getAlphabetOption from "../internals/get-alphabet-option";
var base64Alphabet = _i2c;
var base64UrlAlphabet = _i2cUrl;
var charAt = uncurryThis(''.charAt);
var Uint8Array = globalThis.Uint8Array;
var INCORRECT_BEHAVIOR_OR_DOESNT_EXISTS = !Uint8Array || !Uint8Array.prototype.toBase64 || !function () {
  try {
    var target = new Uint8Array();
    target.toBase64(null);
  } catch (error) {
    return true;
  }
}();

// `Uint8Array.prototype.toBase64` method
// https://tc39.es/ecma262/#sec-uint8array.prototype.tobase64
if (Uint8Array) $({
  target: 'Uint8Array',
  proto: true,
  forced: INCORRECT_BEHAVIOR_OR_DOESNT_EXISTS
}, {
  toBase64: function toBase64(/* options */
  ) {
    var array = anUint8Array(this);
    var options = arguments.length ? anObjectOrUndefined(arguments[0]) : undefined;
    var alphabet = getAlphabetOption(options) === 'base64' ? base64Alphabet : base64UrlAlphabet;
    var omitPadding = !!options && !!options.omitPadding;
    notDetached(this.buffer);
    var result = '';
    var i = 0;
    var length = array.length;
    var triplet;
    var at = function (shift) {
      return charAt(alphabet, triplet >> 6 * shift & 63);
    };
    for (; i + 2 < length; i += 3) {
      triplet = (array[i] << 16) + (array[i + 1] << 8) + array[i + 2];
      result += at(3) + at(2) + at(1) + at(0);
    }
    if (i + 2 === length) {
      triplet = (array[i] << 16) + (array[i + 1] << 8);
      result += at(3) + at(2) + at(1) + (omitPadding ? '' : '=');
    } else if (i + 1 === length) {
      triplet = array[i] << 16;
      result += at(3) + at(2) + (omitPadding ? '' : '==');
    }
    return result;
  }
});
const _cjs_default = {};
export default _cjs_default;
