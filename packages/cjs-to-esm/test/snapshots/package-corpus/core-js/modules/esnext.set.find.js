import $ from "../internals/export";
import bind from "../internals/function-bind-context";
import aSet from "../internals/a-set";
import iterate from "../internals/set-iterate";
// `Set.prototype.find` method
// https://github.com/tc39/proposal-collection-methods
$({
  target: 'Set',
  proto: true,
  real: true,
  forced: true
}, {
  find: function find(callbackfn /* , thisArg */) {
    var set = aSet(this);
    var boundFunction = bind(callbackfn, arguments.length > 1 ? arguments[1] : undefined);
    var result = iterate(set, function (value) {
      if (boundFunction(value, value, set)) return {
        value: value
      };
    }, true);
    return result && result.value;
  }
});
const _cjs_default = {};
export default _cjs_default;
