import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this";
import toIntegerOrInfinity from "../internals/to-integer-or-infinity";
var DatePrototype = Date.prototype;
var thisTimeValue = uncurryThis(DatePrototype.getTime);
var setFullYear = uncurryThis(DatePrototype.setFullYear);

// `Date.prototype.setYear` method
// https://tc39.es/ecma262/#sec-date.prototype.setyear
$({
  target: 'Date',
  proto: true
}, {
  setYear: function setYear(year) {
    // validate
    thisTimeValue(this);
    var y = +year;
    // eslint-disable-next-line no-self-compare -- NaN check
    if (y !== y) return setFullYear(this, y);
    var yi = toIntegerOrInfinity(y);
    var yyyy = yi >= 0 && yi <= 99 ? yi + 1900 : yi;
    return setFullYear(this, yyyy);
  }
});
const _cjs_default = {};
export default _cjs_default;
