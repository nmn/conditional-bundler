import $ from "../internals/export";
import uncurryThis from "../internals/function-uncurry-this";
import aSet from "../internals/a-set";
import iterate from "../internals/set-iterate";
import toString from "../internals/to-string";
var arrayJoin = uncurryThis([].join);
var push = uncurryThis([].push);

// `Set.prototype.join` method
// https://github.com/tc39/proposal-collection-methods
$({
  target: 'Set',
  proto: true,
  real: true,
  forced: true
}, {
  join: function join(separator) {
    var set = aSet(this);
    var sep = separator === undefined ? ',' : toString(separator);
    var array = [];
    iterate(set, function (value) {
      push(array, value);
    });
    return arrayJoin(array, sep);
  }
});
const _cjs_default = {};
export default _cjs_default;
