import globalThis from "../internals/global-this";
import uncurryThis from "../internals/function-uncurry-this";
var Uint8Array = globalThis.Uint8Array;
var SyntaxError = globalThis.SyntaxError;
var min = Math.min;
var stringMatch = uncurryThis(''.match);
const _cjs_default = function (string, into) {
  var stringLength = string.length;
  if (stringLength % 2 !== 0) throw new SyntaxError('String should be an even number of characters');
  var maxLength = into ? min(into.length, stringLength / 2) : stringLength / 2;
  var bytes = into || new Uint8Array(maxLength);
  var segments = stringMatch(string, /.{2}/g);
  var written = 0;
  for (; written < maxLength; written++) {
    var result = +('0x' + segments[written] + '0');
    // eslint-disable-next-line no-self-compare -- NaN check
    if (result !== result) {
      throw new SyntaxError('String should only contain hex characters');
    }
    bytes[written] = result >> 4;
  }
  return {
    bytes: bytes,
    read: written << 1
  };
};
export default _cjs_default;
