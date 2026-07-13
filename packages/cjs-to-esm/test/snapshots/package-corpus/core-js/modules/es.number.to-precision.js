import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this";
import fails from "../internals/fails";
import thisNumberValue from "../internals/this-number-value";
var nativeToPrecision = uncurryThis(1.1.toPrecision);
var FORCED = fails(function () {
  // IE7-
  return nativeToPrecision(1, undefined) !== '1';
}) || !fails(function () {
  // V8 ~ Android 4.3-
  nativeToPrecision({});
});

// `Number.prototype.toPrecision` method
// https://tc39.es/ecma262/#sec-number.prototype.toprecision
$({
  target: 'Number',
  proto: true,
  forced: FORCED
}, {
  toPrecision: function toPrecision(precision) {
    return precision === undefined ? nativeToPrecision(thisNumberValue(this)) : nativeToPrecision(thisNumberValue(this), precision);
  }
});
const _cjs_default = {};
export default _cjs_default;
