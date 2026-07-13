import $ from "../internals/export";
import bind from "../internals/function-bind-context";
import aSet from "../internals/a-set";
import iterate from "../internals/set-iterate";
// `Set.prototype.some` method
// https://github.com/tc39/proposal-collection-methods
$({
  target: 'Set',
  proto: true,
  real: true,
  forced: true
}, {
  some: function some(callbackfn /* , thisArg */) {
    var set = aSet(this);
    var boundFunction = bind(callbackfn, arguments.length > 1 ? arguments[1] : undefined);
    return iterate(set, function (value) {
      if (boundFunction(value, value, set)) return true;
    }, true) === true;
  }
});
const _cjs_default = {};
export default _cjs_default;
