import $ from "../internals/export";
import $transfer from "../internals/array-buffer-transfer";
// `ArrayBuffer.prototype.transfer` method
// https://tc39.es/ecma262/#sec-arraybuffer.prototype.transfer
if ($transfer) $({
  target: 'ArrayBuffer',
  proto: true
}, {
  transfer: function transfer() {
    return $transfer(this, arguments.length ? arguments[0] : undefined, true);
  }
});
const _cjs_default = {};
export default _cjs_default;
