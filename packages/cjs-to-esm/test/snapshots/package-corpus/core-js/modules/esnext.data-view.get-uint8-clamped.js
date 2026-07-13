import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this";
// eslint-disable-next-line es/no-typed-arrays -- safe
var getUint8 = uncurryThis(DataView.prototype.getUint8);

// `DataView.prototype.getUint8Clamped` method
// https://github.com/tc39/proposal-dataview-get-set-uint8clamped
$({
  target: 'DataView',
  proto: true,
  forced: true
}, {
  getUint8Clamped: function getUint8Clamped(byteOffset) {
    return getUint8(this, byteOffset);
  }
});
const _cjs_default = {};
export default _cjs_default;
