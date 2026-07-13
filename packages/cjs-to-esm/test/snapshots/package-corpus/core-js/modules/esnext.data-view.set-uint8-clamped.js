import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this";
import aDataView from "../internals/a-data-view";
import toIndex from "../internals/to-index";
import toUint8Clamped from "../internals/to-uint8-clamped";
// eslint-disable-next-line es/no-typed-arrays -- safe
var setUint8 = uncurryThis(DataView.prototype.setUint8);

// `DataView.prototype.setUint8Clamped` method
// https://github.com/tc39/proposal-dataview-get-set-uint8clamped
$({
  target: 'DataView',
  proto: true,
  forced: true
}, {
  setUint8Clamped: function setUint8Clamped(byteOffset, value) {
    setUint8(aDataView(this), toIndex(byteOffset), toUint8Clamped(value));
  }
});
const _cjs_default = {};
export default _cjs_default;
