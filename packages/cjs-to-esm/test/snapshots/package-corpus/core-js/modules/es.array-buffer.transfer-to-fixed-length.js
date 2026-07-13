import $ from "../internals/export";
import $transfer from "../internals/array-buffer-transfer";
// `ArrayBuffer.prototype.transferToFixedLength` method
// https://tc39.es/ecma262/#sec-arraybuffer.prototype.transfertofixedlength
if ($transfer) $({
  target: 'ArrayBuffer',
  proto: true
}, {
  transferToFixedLength: function transferToFixedLength() {
    return $transfer(this, arguments.length ? arguments[0] : undefined, false);
  }
});
const _cjs_default = {};
export default _cjs_default;
