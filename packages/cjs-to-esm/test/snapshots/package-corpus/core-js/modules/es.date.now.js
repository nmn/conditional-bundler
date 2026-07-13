import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this";
// TODO: Remove from `core-js@4`

var $Date = Date;
var thisTimeValue = uncurryThis($Date.prototype.getTime);

// `Date.now` method
// https://tc39.es/ecma262/#sec-date.now
$({
  target: 'Date',
  stat: true
}, {
  now: function now() {
    return thisTimeValue(new $Date());
  }
});
const _cjs_default = {};
export default _cjs_default;
