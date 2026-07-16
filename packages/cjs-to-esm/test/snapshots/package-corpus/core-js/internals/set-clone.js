import SetHelpers from "../internals/set-helpers";
import iterate from "../internals/set-iterate";
var Set = SetHelpers.Set;
var add = SetHelpers.add;
const _cjs_default = function (set) {
  var result = new Set();
  iterate(set, function (it) {
    add(result, it);
  });
  return result;
};
export default _cjs_default;
