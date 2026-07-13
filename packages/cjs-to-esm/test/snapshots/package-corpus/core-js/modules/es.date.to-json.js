import $ from "../internals/export";
import fails from "../internals/fails";
import toObject from "../internals/to-object";
import toPrimitive from "../internals/to-primitive";
var FORCED = fails(function () {
  return new Date(NaN).toJSON() !== null || Date.prototype.toJSON.call({
    toISOString: function () {
      return 1;
    }
  }) !== 1;
});

// `Date.prototype.toJSON` method
// https://tc39.es/ecma262/#sec-date.prototype.tojson
$({
  target: 'Date',
  proto: true,
  arity: 1,
  forced: FORCED
}, {
  // eslint-disable-next-line no-unused-vars -- required for `.length`
  toJSON: function toJSON(key) {
    var O = toObject(this);
    var pv = toPrimitive(O, 'number');
    return typeof pv == 'number' && !isFinite(pv) ? null : O.toISOString();
  }
});
const _cjs_default = {};
export default _cjs_default;
